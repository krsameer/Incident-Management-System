"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertTransitionAllowed = assertTransitionAllowed;
class OpenState {
    name = 'OPEN';
    canTransitionTo(next) {
        return next === 'INVESTIGATING' || next === 'RESOLVED';
    }
}
class InvestigatingState {
    name = 'INVESTIGATING';
    canTransitionTo(next) {
        return next === 'RESOLVED';
    }
}
class ResolvedState {
    name = 'RESOLVED';
    canTransitionTo(next, rca) {
        return next === 'CLOSED' && Boolean(rca?.rootCauseCategory && rca?.fixApplied && rca?.preventionSteps);
    }
}
class ClosedState {
    name = 'CLOSED';
    canTransitionTo() {
        return false;
    }
}
const states = {
    OPEN: new OpenState(),
    INVESTIGATING: new InvestigatingState(),
    RESOLVED: new ResolvedState(),
    CLOSED: new ClosedState()
};
function assertTransitionAllowed(workItem, next, rca) {
    const currentState = states[workItem.status];
    if (!currentState.canTransitionTo(next, rca)) {
        throw new Error(`Invalid transition from ${workItem.status} to ${next}`);
    }
}
