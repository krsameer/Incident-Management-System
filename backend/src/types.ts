export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type WorkItemStatus = 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'CLOSED';

export interface SignalInput {
  componentId: string;
  componentType: string;
  source: string;
  severityHint?: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp?: string;
}

export interface SignalRecord extends SignalInput {
  _id?: import('mongodb').ObjectId;
  workItemId?: string | null;
  receivedAt: string;
}

export interface RCAInput {
  incidentStartAt: string;
  incidentEndAt: string;
  rootCauseCategory: string;
  fixApplied: string;
  preventionSteps: string;
}

export interface RCARecord extends RCAInput {
  submittedAt: string;
}

export interface WorkItemRecord {
  id: string;
  componentId: string;
  componentType: string;
  title: string;
  severity: Severity;
  alertChannel: string;
  responderTeam: string;
  firstSignalAt: string;
  lastSignalAt: string;
  status: WorkItemStatus;
  mttrMinutes?: number | null;
  closedAt?: string | null;
  rca?: RCARecord | null;
}

export interface AlertRecord {
  id: string;
  workItemId: string;
  severity: Severity;
  responderTeam: string;
  alertChannel: string;
  message: string;
  createdAt: string;
}
