import { Db } from 'mongodb';
import { Pool, PoolClient } from 'pg';
import { ObjectId } from 'mongodb';
import { CacheService } from './cache';
import { DebounceCoordinator } from './debounce';
import { RCAInput, RCARecord, SignalInput, WorkItemRecord, WorkItemStatus } from '../types';
import { assertTransitionAllowed } from '../domain/workItemState';

export class IncidentService {
  constructor(
    private readonly mongoDb: Db,
    private readonly postgresPool: Pool,
    private readonly cacheService: CacheService,
    private readonly debounceCoordinator: DebounceCoordinator
  ) {}

  async ingestSignal(signal: SignalInput): Promise<{ accepted: true }> {
    await this.debounceCoordinator.persistSignal(signal);
    return { accepted: true };
  }

  async listDashboard(): Promise<WorkItemRecord[]> {
    const cached = await this.cacheService.getDashboardState();
    if (cached.length > 0) {
      return cached.sort((left, right) => severityRank(right.severity) - severityRank(left.severity));
    }

    const result = await this.postgresPool.query('SELECT * FROM work_items WHERE status <> $1 ORDER BY created_at DESC', ['CLOSED']);
    return result.rows.map(toWorkItemRecord);
  }

  async getWorkItemDetail(id: string): Promise<{ workItem: WorkItemRecord; signals: SignalInput[] }> {
    const workItemResult = await this.postgresPool.query('SELECT * FROM work_items WHERE id = $1', [id]);
    const workItem = workItemResult.rows[0];
    if (!workItem) {
      throw new Error('Work item not found');
    }

    const rcaResult = await this.postgresPool.query('SELECT * FROM rca_records WHERE work_item_id = $1', [id]);
    const signalRecords = await this.mongoDb.collection('signals').find({ workItemId: id }).sort({ receivedAt: 1 }).toArray();

    return {
      workItem: {
        ...toWorkItemRecord(workItem),
        rca: rcaResult.rows[0] ? toRcaRecord(rcaResult.rows[0]) : null
      },
      signals: signalRecords.map((signal) => ({
        componentId: signal.componentId,
        componentType: signal.componentType,
        source: signal.source,
        severityHint: signal.severityHint,
        message: signal.message,
        details: signal.details,
        timestamp: signal.timestamp,
        receivedAt: signal.receivedAt,
        workItemId: signal.workItemId
      }))
    };
  }

  async transitionWorkItem(id: string, status: WorkItemStatus): Promise<WorkItemRecord> {
    const workItem = await this.loadWorkItem(id);
    if (!workItem) {
      throw new Error('Work item not found');
    }

    const nextStatus = status;
    const rca = await this.loadRca(id);
    assertTransitionAllowed(workItem, nextStatus, rca);

    const updated = await this.postgresPool.query(
      'UPDATE work_items SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [nextStatus, id]
    );

    const nextWorkItem = toWorkItemRecord(updated.rows[0]);
    await this.cacheService.upsertWorkItem(nextWorkItem);
    return nextWorkItem;
  }

  async submitRca(id: string, input: RCAInput): Promise<WorkItemRecord> {
    const workItem = await this.loadWorkItem(id);
    if (!workItem) {
      throw new Error('Work item not found');
    }

    const rca: RCARecord = {
      ...input,
      submittedAt: new Date().toISOString()
    };

    await this.postgresPool.query(
      `INSERT INTO rca_records (id, work_item_id, incident_start_at, incident_end_at, root_cause_category, fix_applied, prevention_steps, submitted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (work_item_id) DO UPDATE SET
         incident_start_at = EXCLUDED.incident_start_at,
         incident_end_at = EXCLUDED.incident_end_at,
         root_cause_category = EXCLUDED.root_cause_category,
         fix_applied = EXCLUDED.fix_applied,
         prevention_steps = EXCLUDED.prevention_steps,
         submitted_at = EXCLUDED.submitted_at`,
      [new ObjectId().toHexString(), id, rca.incidentStartAt, rca.incidentEndAt, rca.rootCauseCategory, rca.fixApplied, rca.preventionSteps, rca.submittedAt]
    );

    const mttrMinutes = calculateMttrMinutes(rca.incidentStartAt, rca.incidentEndAt);
    const updated = await this.postgresPool.query(
      'UPDATE work_items SET status = $1, mttr_minutes = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
      ['RESOLVED', mttrMinutes, id]
    );

    const nextWorkItem = toWorkItemRecord(updated.rows[0]);
    await this.cacheService.upsertWorkItem(nextWorkItem);
    return nextWorkItem;
  }

  async closeWorkItem(id: string): Promise<WorkItemRecord> {
    const workItem = await this.loadWorkItem(id);
    if (!workItem) {
      throw new Error('Work item not found');
    }

    const rca = await this.loadRca(id);
    if (!rca || !rca.rootCauseCategory || !rca.fixApplied || !rca.preventionSteps) {
      throw new Error('RCA is required before closing a work item');
    }

    assertTransitionAllowed({ ...workItem, rca }, 'CLOSED', rca);
    const updated = await this.postgresPool.query(
      'UPDATE work_items SET status = $1, closed_at = NOW(), updated_at = NOW() WHERE id = $2 RETURNING *',
      ['CLOSED', id]
    );
    const nextWorkItem = toWorkItemRecord(updated.rows[0]);
    await this.cacheService.upsertWorkItem(nextWorkItem);
    return nextWorkItem;
  }

  async healthCheck(): Promise<{ postgres: boolean; mongo: boolean }> {
    await this.postgresPool.query('SELECT 1');
    await this.mongoDb.command({ ping: 1 });
    return { postgres: true, mongo: true };
  }

  private async loadWorkItem(id: string): Promise<WorkItemRecord | null> {
    const result = await this.postgresPool.query('SELECT * FROM work_items WHERE id = $1', [id]);
    return result.rows[0] ? toWorkItemRecord(result.rows[0]) : null;
  }

  private async loadRca(id: string): Promise<RCARecord | null> {
    const result = await this.postgresPool.query('SELECT * FROM rca_records WHERE work_item_id = $1', [id]);
    return result.rows[0] ? toRcaRecord(result.rows[0]) : null;
  }
}

function severityRank(severity: string): number {
  switch (severity) {
    case 'critical':
      return 4;
    case 'high':
      return 3;
    case 'medium':
      return 2;
    default:
      return 1;
  }
}

function toWorkItemRecord(row: Record<string, unknown>): WorkItemRecord {
  return {
    id: String(row.id),
    componentId: String(row.component_id),
    componentType: String(row.component_type),
    title: String(row.title),
    severity: row.severity as WorkItemRecord['severity'],
    alertChannel: String(row.alert_channel),
    responderTeam: String(row.responder_team),
    firstSignalAt: String(row.first_signal_at),
    lastSignalAt: String(row.last_signal_at),
    status: row.status as WorkItemStatus,
    mttrMinutes: row.mttr_minutes === null ? null : Number(row.mttr_minutes),
    closedAt: row.closed_at ? String(row.closed_at) : null,
    rca: null
  };
}

function toRcaRecord(row: Record<string, unknown>): RCARecord {
  return {
    incidentStartAt: String(row.incident_start_at),
    incidentEndAt: String(row.incident_end_at),
    rootCauseCategory: String(row.root_cause_category),
    fixApplied: String(row.fix_applied),
    preventionSteps: String(row.prevention_steps),
    submittedAt: String(row.submitted_at)
  };
}

function calculateMttrMinutes(start: string, end: string): number {
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000));
}
