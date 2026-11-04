# Oshud Wala - Architecture (Phase 3 design v2)

**Status: APPROVED.** Transitioning to implementation (Phase 4). 
v2 changes incorporated: Clinic and Pharmacy are one unified `Establishment` (see `ESTABLISHMENT.md`) and notifications utilize a full push + in-app system (see `NOTIFICATIONS.md`). Conflict check against the v1 approval: `DESIGN_CHANGES_V2.md`.

## 1. Style
Modular monolith: one Express + TypeScript deployable, split into 34 business modules under `src/modules/` (clinic and pharmacy are one `establishment` module). Background work runs in separate worker processes from the same codebase (BullMQ). Module boundaries: a module may call another module's **service**, never its repository or Prisma models directly.

## 2. Request pipeline
request -> requestId + structured logger -> helmet/cors -> rate limit (Redis)
        -> body parse (size limits) -> authenticate (JWT) -> authorize (RBAC permission)
        -> resource-scope check (clinic / pharmacy / ownership / assignment)
        -> Zod validation -> idempotency middleware (mutating critical routes)
        -> controller -> service (business rules + DB transaction) -> repository
        -> response envelope / global error handler

Response envelope:
```json
{ "success": true, "data": {}, "meta": { "page": 1, "limit": 20, "total": 0 } }