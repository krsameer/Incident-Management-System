"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildServer = buildServer;
exports.startServer = startServer;
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const rate_limit_1 = __importDefault(require("@fastify/rate-limit"));
const config_1 = require("./config");
const incidentService_1 = require("./services/incidentService");
const ingestionBuffer_1 = require("./services/ingestionBuffer");
const metrics_1 = require("./services/metrics");
const cache_1 = require("./services/cache");
const mongo_1 = require("./db/mongo");
const postgres_1 = require("./db/postgres");
const redis_1 = require("./db/redis");
const debounce_1 = require("./services/debounce");
const app = (0, fastify_1.default)({ logger: true });
const metricsService = new metrics_1.MetricsService();
const ingestionBuffer = new ingestionBuffer_1.IngestionBuffer(50_000);
async function buildServer() {
    await app.register(cors_1.default, { origin: config_1.config.CORS_ORIGIN });
    await app.register(rate_limit_1.default, {
        max: 200,
        timeWindow: '1 minute'
    });
    const postgresPool = (0, postgres_1.createPostgresPool)(config_1.config.POSTGRES_URL);
    await (0, postgres_1.initializePostgres)(postgresPool);
    const mongoDb = await (0, mongo_1.createMongoDb)(config_1.config.MONGODB_URL, config_1.config.MONGODB_DB);
    const redisClient = (0, redis_1.createRedisClient)(config_1.config.REDIS_URL);
    await redisClient.connect();
    const cacheService = new cache_1.CacheService(redisClient);
    const debounceCoordinator = new debounce_1.DebounceCoordinator(mongoDb, postgresPool, cacheService, metricsService);
    const incidentService = new incidentService_1.IncidentService(mongoDb, postgresPool, cacheService, debounceCoordinator);
    metricsService.start();
    setInterval(async () => {
        const batch = ingestionBuffer.drain(500);
        for (const signal of batch) {
            await debounceCoordinator.persistSignal(signal);
        }
    }, 100).unref();
    app.get('/health', async () => {
        const status = await incidentService.healthCheck();
        return { ok: true, ...status };
    });
    app.post('/signals', async (request, reply) => {
        const signal = request.body;
        const accepted = ingestionBuffer.enqueue(signal);
        if (!accepted) {
            reply.code(503);
            return { ok: false, reason: 'Backpressure buffer is full' };
        }
        return reply.code(202).send({ ok: true });
    });
    app.get('/dashboard', async () => {
        return { incidents: await incidentService.listDashboard() };
    });
    app.get('/work-items/:id', async (request) => {
        const params = request.params;
        return incidentService.getWorkItemDetail(params.id);
    });
    app.patch('/work-items/:id/status', async (request) => {
        const params = request.params;
        const body = request.body;
        return incidentService.transitionWorkItem(params.id, body.status);
    });
    app.post('/work-items/:id/rca', async (request) => {
        const params = request.params;
        const body = request.body;
        return incidentService.submitRca(params.id, body);
    });
    app.post('/work-items/:id/close', async (request) => {
        const params = request.params;
        return incidentService.closeWorkItem(params.id);
    });
    app.get('/metrics/timeseries', async () => {
        const result = await postgresPool.query(`
      SELECT date_trunc('hour', created_at) AS bucket, severity, COUNT(*)::int AS total
      FROM work_items
      GROUP BY bucket, severity
      ORDER BY bucket DESC
      LIMIT 48
    `);
        return { buckets: result.rows };
    });
    return { app, redisClient, postgresPool };
}
async function startServer() {
    const { app, redisClient, postgresPool } = await buildServer();
    await app.listen({ port: config_1.config.PORT, host: '0.0.0.0' });
    const shutdown = async () => {
        await app.close();
        await redisClient.quit();
        await postgresPool.end();
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}
