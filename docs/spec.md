# IMS Specification Notes

## Goals

- Ingest high-volume failure signals.
- Buffer bursts without blocking the API.
- Create one work item per component burst using debounce logic.
- Keep raw signals in MongoDB and structured work items/RCA records in PostgreSQL.
- Expose active incidents through a fast cache path.

## Core Data Flow

1. The ingestion endpoint accepts a signal and places it into a bounded in-memory buffer.
2. A background pump persists the raw signal to MongoDB.
3. The pump registers the signal with a debounce bucket keyed by component ID.
4. When the debounce window expires, a single work item is created transactionally in PostgreSQL.
5. The raw signals are linked back to that work item in MongoDB.
6. Redis stores the dashboard snapshot for quick reads.

## Workflow Rules

- OPEN -> INVESTIGATING -> RESOLVED -> CLOSED is enforced by a state machine.
- CLOSED is rejected unless a complete RCA is present.
- MTTR is derived from incident start and RCA submission timestamps.
