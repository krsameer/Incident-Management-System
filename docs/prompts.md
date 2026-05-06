# Repository Creation Prompts

This repository was created to satisfy the IMS engineering challenge prompt. The implementation plan and structure were intentionally kept in-repo so future changes can be audited alongside the code.

The main design choices were:

- TypeScript on both backend and frontend.
- PostgreSQL for transactional workflow records.
- MongoDB for raw signal audit logs.
- Redis for dashboard state and backpressure support.
- A state machine for incident lifecycle transitions.
- Strategy-based alert routing by component type.
