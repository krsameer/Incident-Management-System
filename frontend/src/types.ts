export type WorkItemStatus = 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'CLOSED';

export interface RCARecord {
  incidentStartAt: string;
  incidentEndAt: string;
  rootCauseCategory: string;
  fixApplied: string;
  preventionSteps: string;
  submittedAt: string;
}

export interface WorkItemRecord {
  id: string;
  componentId: string;
  componentType: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  alertChannel: string;
  responderTeam: string;
  firstSignalAt: string;
  lastSignalAt: string;
  status: WorkItemStatus;
  mttrMinutes?: number | null;
  closedAt?: string | null;
  rca?: RCARecord | null;
}

export interface SignalRecord {
  componentId: string;
  componentType: string;
  source: string;
  severityHint?: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp?: string;
  receivedAt: string;
  workItemId?: string | null;
}
