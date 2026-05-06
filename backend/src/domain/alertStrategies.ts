import { Severity, WorkItemRecord } from '../types';

export interface AlertStrategy {
  createAlert(workItem: Pick<WorkItemRecord, 'componentType' | 'componentId' | 'severity' | 'title'>): {
    severity: Severity;
    responderTeam: string;
    alertChannel: string;
    message: string;
  };
}

class RdbmsAlertStrategy implements AlertStrategy {
  createAlert(workItem: Pick<WorkItemRecord, 'componentType' | 'componentId' | 'severity' | 'title'>) {
    return {
      severity: 'critical' as const,
      responderTeam: 'database-oncall',
      alertChannel: 'pager',
      message: `P0 RDBMS incident on ${workItem.componentId}: ${workItem.title}`
    };
  }
}

class CacheAlertStrategy implements AlertStrategy {
  createAlert(workItem: Pick<WorkItemRecord, 'componentType' | 'componentId' | 'severity' | 'title'>) {
    return {
      severity: 'medium' as const,
      responderTeam: 'platform-cache',
      alertChannel: 'slack',
      message: `P2 cache degradation on ${workItem.componentId}: ${workItem.title}`
    };
  }
}

class QueueAlertStrategy implements AlertStrategy {
  createAlert(workItem: Pick<WorkItemRecord, 'componentType' | 'componentId' | 'severity' | 'title'>) {
    return {
      severity: 'high' as const,
      responderTeam: 'messaging-oncall',
      alertChannel: 'pager',
      message: `Async queue issue on ${workItem.componentId}: ${workItem.title}`
    };
  }
}

class DefaultAlertStrategy implements AlertStrategy {
  createAlert(workItem: Pick<WorkItemRecord, 'componentType' | 'componentId' | 'severity' | 'title'>) {
    return {
      severity: workItem.severity,
      responderTeam: 'service-owner',
      alertChannel: 'slack',
      message: `Incident for ${workItem.componentId}: ${workItem.title}`
    };
  }
}

export function resolveAlertStrategy(componentType: string): AlertStrategy {
  const normalized = componentType.toLowerCase();
  if (normalized.includes('rdbms') || normalized.includes('database')) {
    return new RdbmsAlertStrategy();
  }
  if (normalized.includes('cache')) {
    return new CacheAlertStrategy();
  }
  if (normalized.includes('queue') || normalized.includes('async')) {
    return new QueueAlertStrategy();
  }
  return new DefaultAlertStrategy();
}
