import { Db, ObjectId } from 'mongodb';
import { Pool } from 'pg';
import { CacheService } from './cache';
import { MetricsService } from './metrics';
import { SignalInput, SignalRecord, WorkItemRecord } from '../types';
import { resolveAlertStrategy } from '../domain/alertStrategies';
import { assertTransitionAllowed } from '../domain/workItemState';
import { withTransaction } from '../db/postgres';

interface DebounceBucket {
  componentId: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
  timer: NodeJS.Timeout;
  signalIds: ObjectId[];
  componentType: string;
  latestSignal: SignalInput;
}

export class DebounceCoordinator {
  private readonly buckets = new Map<string, DebounceBucket>();

  constructor(
    private readonly mongoDb: Db,
    private readonly postgresPool: Pool,
    private readonly cacheService: CacheService,
    private readonly metricsService: MetricsService
  ) {}

  async persistSignal(signal: SignalInput): Promise<void> {
    const now = new Date();
    const signalId = new ObjectId();
    const result = await this.mongoDb.collection<SignalRecord>('signals').insertOne({
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

  private async finalizeBucket(componentId: string): Promise<void> {
    const bucket = this.buckets.get(componentId);
    if (!bucket) {
      return;
    }
    this.buckets.delete(componentId);

    const alertStrategy = resolveAlertStrategy(bucket.componentType);
    const severity = bucket.latestSignal.severityHint === 'critical' ? 'critical' : bucket.latestSignal.severityHint === 'high' ? 'high' : bucket.componentType.toLowerCase().includes('cache') ? 'medium' : 'low';
    const title = `${bucket.latestSignal.source.toUpperCase()} signal burst on ${bucket.componentId}`;
    const workItemId = new ObjectId().toHexString();
    const workItem: WorkItemRecord = {
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

    await withTransaction(this.postgresPool, async (client) => {
      await client.query(
        `INSERT INTO work_items (id, component_id, component_type, title, severity, alert_channel, responder_team, first_signal_at, last_signal_at, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
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
        ]
      );

      await client.query(
        `INSERT INTO alerts (id, work_item_id, severity, responder_team, alert_channel, message)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [new ObjectId().toHexString(), workItem.id, alert.severity, alert.responderTeam, alert.alertChannel, alert.message]
      );
    });

    await this.mongoDb.collection<SignalRecord>('signals').updateMany({ _id: { $in: bucket.signalIds } }, { $set: { workItemId } });

    const currentDashboard = await this.cacheService.getDashboardState();
    await this.cacheService.upsertDashboardState([{ ...workItem, rca: null }, ...currentDashboard]);
    this.metricsService.incrementWorkItems();
  }
}
