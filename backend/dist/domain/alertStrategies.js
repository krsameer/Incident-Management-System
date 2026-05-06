"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveAlertStrategy = resolveAlertStrategy;
class RdbmsAlertStrategy {
    createAlert(workItem) {
        return {
            severity: 'critical',
            responderTeam: 'database-oncall',
            alertChannel: 'pager',
            message: `P0 RDBMS incident on ${workItem.componentId}: ${workItem.title}`
        };
    }
}
class CacheAlertStrategy {
    createAlert(workItem) {
        return {
            severity: 'medium',
            responderTeam: 'platform-cache',
            alertChannel: 'slack',
            message: `P2 cache degradation on ${workItem.componentId}: ${workItem.title}`
        };
    }
}
class QueueAlertStrategy {
    createAlert(workItem) {
        return {
            severity: 'high',
            responderTeam: 'messaging-oncall',
            alertChannel: 'pager',
            message: `Async queue issue on ${workItem.componentId}: ${workItem.title}`
        };
    }
}
class DefaultAlertStrategy {
    createAlert(workItem) {
        return {
            severity: workItem.severity,
            responderTeam: 'service-owner',
            alertChannel: 'slack',
            message: `Incident for ${workItem.componentId}: ${workItem.title}`
        };
    }
}
function resolveAlertStrategy(componentType) {
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
