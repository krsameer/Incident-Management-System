import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { config } from './config';
import { IncidentService } from './services/incidentService';
import { IngestionBuffer } from './services/ingestionBuffer';
import { MetricsService } from './services/metrics';
import { CacheService } from './services/cache';
import { createMongoDb } from './db/mongo';
import { createPostgresPool, initializePostgres } from './db/postgres';
import { createRedisClient } from './db/redis';
import { DebounceCoordinator } from './services/debounce';
import { RCAInput, SignalInput } from './types';

const app = Fastify({ logger: true });
const metricsService = new MetricsService();
const ingestionBuffer = new IngestionBuffer(50_000);

async function waitForPostgres(url: string, maxRetries: number = 30): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const testPool = createPostgresPool(url);
      await testPool.query('SELECT 1');
      testPool.end();
      return;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      console.log(`[startup] PostgreSQL not ready, retrying in 1s (${i + 1}/${maxRetries})...`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

async function waitForMongo(url: string, dbName: string, maxRetries: number = 30): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const db = await createMongoDb(url, dbName);
      await db.command({ ping: 1 });
      return;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      console.log(`[startup] MongoDB not ready, retrying in 1s (${i + 1}/${maxRetries})...`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

export async function buildServer() {
  await app.register(cors, { origin: config.CORS_ORIGIN });
  await app.register(rateLimit, {
    max: 200,
    timeWindow: '1 minute'
  });

  console.log('[startup] Waiting for PostgreSQL...');
  await waitForPostgres(config.POSTGRES_URL);
  console.log('[startup] PostgreSQL is ready');

  console.log('[startup] Waiting for MongoDB...');
  await waitForMongo(config.MONGODB_URL, config.MONGODB_DB);
  console.log('[startup] MongoDB is ready');

  const postgresPool = createPostgresPool(config.POSTGRES_URL);
  await initializePostgres(postgresPool);

  const mongoDb = await createMongoDb(config.MONGODB_URL, config.MONGODB_DB);
  console.log('[startup] Connecting to Redis...');
  const redisClient = createRedisClient(config.REDIS_URL);
  await redisClient.connect();
  console.log('[startup] Redis is ready');

  const cacheService = new CacheService(redisClient);
  const debounceCoordinator = new DebounceCoordinator(mongoDb, postgresPool, cacheService, metricsService);
  const incidentService = new IncidentService(mongoDb, postgresPool, cacheService, debounceCoordinator);

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
    const signal = request.body as SignalInput;
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
    const params = request.params as { id: string };
    return incidentService.getWorkItemDetail(params.id);
  });

  app.patch('/work-items/:id/status', async (request) => {
    const params = request.params as { id: string };
    const body = request.body as { status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'CLOSED' };
    return incidentService.transitionWorkItem(params.id, body.status);
  });

  app.post('/work-items/:id/rca', async (request) => {
    const params = request.params as { id: string };
    const body = request.body as RCAInput;
    return incidentService.submitRca(params.id, body);
  });

  app.post('/work-items/:id/close', async (request) => {
    const params = request.params as { id: string };
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

export async function startServer(): Promise<void> {
  const { app, redisClient, postgresPool } = await buildServer();
  await app.listen({ port: config.PORT, host: '0.0.0.0' });
  console.log(`[startup] API server listening on http://0.0.0.0:${config.PORT}`);

  const shutdown = async () => {
    await app.close();
    await redisClient.quit();
    await postgresPool.end();
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
