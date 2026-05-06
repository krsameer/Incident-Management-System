"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DebounceCoordinator = void 0;
const mongodb_1 = require("mongodb");
const alertStrategies_1 = require("../domain/alertStrategies");
const postgres_1 = require("../db/postgres");
class DebounceCoordinator {
    mongoDb;
    postgresPool;
    cacheService;
    metricsService;
    buckets = new Map();
    constructor(mongoDb, postgresPool, cacheService, metricsService) {
        this.mongoDb = mongoDb;
        this.postgresPool = postgresPool;
        this.cacheService = cacheService;
        this.metricsService = metricsService;
    }
    async persistSignal(signal) {
        const now = new Date();
        const signalId = new mongodb_1.ObjectId();
        const result = await this.mongoDb.collection('signals').insertOne({
            _id: signalId,
            ...signal,
            receivedAt: now.toISOString(),
            workItemId: null
        });
        this.metricsService.incrementSignals();
        const bucketKey = signal.componentId;
        const existingBucket = this.buckets.get(bucketKey);
        if (existingBucket) {
            existingBucket.lastSeenAt = now;
            existingBucket.signalIds.push(signalId);
            existingBucket.latestSignal = signal;
            return;
        }
        const timer = setTimeout(() => {
            void this.finalizeBucket(bucketKey);
        }, 10_000);
        timer.unref();
        this.buckets.set(bucketKey, {
            componentId: signal.componentId,
            firstSeenAt: now,
            lastSeenAt: now,
            timer,
            signalIds: [signalId],
            componentType: signal.componentType,
            latestSignal: signal
        });
    }
    async finalizeBucket(componentId) {
        const bucket = this.buckets.get(componentId);
        if (!bucket) {
            return;
        }
        this.buckets.delete(componentId);
        const alertStrategy = (0, alertStrategies_1.resolveAlertStrategy)(bucket.componentType);
        const severity = bucket.latestSignal.severityHint === 'critical' ? 'critical' : bucket.latestSignal.severityHint === 'high' ? 'high' : bucket.componentType.toLowerCase().includes('cache') ? 'medium' : 'low';
        const title = `${bucket.latestSignal.source.toUpperCase()} signal burst on ${bucket.componentId}`;
        const workItemId = new mongodb_1.ObjectId().toHexString();
        const workItem = {
            id: workItemId,
            componentId: bucket.componentId,
            componentType: bucket.componentType,
            title,
            severity,
            alertChannel: alertStrategy.createAlert({ componentId: bucket.componentId, componentType: bucket.componentType, severity, title }).alertChannel,
            responderTeam: alertStrategy.createAlert({ componentId: bucket.componentId, componentType: bucket.componentType, severity, title }).responderTeam,
            firstSignalAt: bucket.firstSeenAt.toISOString(),
            lastSignalAt: bucket.lastSeenAt.toISOString(),
            status: 'OPEN',
            mttrMinutes: null,
            closedAt: null,
            rca: null
        };
        const alert = alertStrategy.createAlert({ componentId: bucket.componentId, componentType: bucket.componentType, severity, title });
        await (0, postgres_1.withTransaction)(this.postgresPool, async (client) => {
            await client.query(`INSERT INTO work_items (id, component_id, component_type, title, severity, alert_channel, responder_team, first_signal_at, last_signal_at, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`, [
                workItem.id,
                workItem.componentId,
                workItem.componentType,
                workItem.title,
                workItem.severity,
                workItem.alertChannel,
                workItem.responderTeam,
                workItem.firstSignalAt,
                workItem.lastSignalAt,
                workItem.status
            ]);
            await client.query(`INSERT INTO alerts (id, work_item_id, severity, responder_team, alert_channel, message)
         VALUES ($1, $2, $3, $4, $5, $6)`, [new mongodb_1.ObjectId().toHexString(), workItem.id, alert.severity, alert.responderTeam, alert.alertChannel, alert.message]);
        });
        await this.mongoDb.collection('signals').updateMany({ _id: { $in: bucket.signalIds } }, { $set: { workItemId } });
        const currentDashboard = await this.cacheService.getDashboardState();
        await this.cacheService.upsertDashboardState([{ ...workItem, rca: null }, ...currentDashboard]);
        this.metricsService.incrementWorkItems();
    }
}
exports.DebounceCoordinator = DebounceCoordinator;
