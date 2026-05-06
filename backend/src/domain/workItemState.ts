import { RCARecord, WorkItemRecord, WorkItemStatus } from '../types';

interface WorkItemState {
  name: WorkItemStatus;
  canTransitionTo(next: WorkItemStatus, rca?: RCARecord | null): boolean;
}

class OpenState implements WorkItemState {
  name: WorkItemStatus = 'OPEN';

  canTransitionTo(next: WorkItemStatus): boolean {
    return next === 'INVESTIGATING' || next === 'RESOLVED';
  }
}

class InvestigatingState implements WorkItemState {
  name: WorkItemStatus = 'INVESTIGATING';

  canTransitionTo(next: WorkItemStatus): boolean {
    return next === 'RESOLVED';
  }
}

class ResolvedState implements WorkItemState {
  name: WorkItemStatus = 'RESOLVED';

  canTransitionTo(next: WorkItemStatus, rca?: RCARecord | null): boolean {
    return next === 'CLOSED' && Boolean(rca?.rootCauseCategory && rca?.fixApplied && rca?.preventionSteps);
  }
}

class ClosedState implements WorkItemState {
  name: WorkItemStatus = 'CLOSED';

  canTransitionTo(): boolean {
    return false;
  }
}

const states: Record<WorkItemStatus, WorkItemState> = {
  OPEN: new OpenState(),
  INVESTIGATING: new InvestigatingState(),
  RESOLVED: new ResolvedState(),
  CLOSED: new ClosedState()
};

export function assertTransitionAllowed(workItem: WorkItemRecord, next: WorkItemStatus, rca?: RCARecord | null): void {
  const currentState = states[workItem.status];
  if (!currentState.canTransitionTo(next, rca)) {
    throw new Error(`Invalid transition from ${workItem.status} to ${next}`);
  }
}
