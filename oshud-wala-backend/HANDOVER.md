# HANDOVER

Last updated: 2026-11-03 (end of Phase 2)

## Purpose
Allows a new conversation or another engineer to continue without guessing. The full requirements are in the original Master Project Development Instruction (Parts 1 to 17); the README summarizes them.

## Current Project Architecture
Planned: Node.js, Express, TypeScript, modular monolith. Supabase PostgreSQL with Prisma. Redis, BullMQ, Socket.IO. Own JWT auth with refresh rotation and RBAC. Seven roles. 36 modules under `src/modules/`. **No application code exists yet.**

## Latest Project State
- Location: `Vivek da/oshud-wala-backend/` on the owner's Mac (zsh).
- Folder structure created and verified by the owner via `tree`.
- README and tracking documents written (empty placeholders replaced once the owner places the delivered files).

## Important Decisions
- Own authentication, not Supabase Auth.
- Money stored as integer paise or Decimal.
- PostgreSQL is the source of truth; Redis never authoritative for balances or order state.
- Delivery OTP is in-app (Customer App to Rider App), stored hashed, never visible to the rider.
- Rider earns Rs 40 per delivery, exactly once; COD cash is separate from earnings.
- A module is approved only when the owner says: `OK – ALL POSTMAN TESTS PASSED`.

## Current Database State
No schema, no migrations, no database connected.

## Last Completed Module
Project structure and README (documentation only).

## Remaining Work
Everything functional: Phase 3 design, Phase 4 setup, Phase 5 authentication, then 25 further modules in the order listed in README Section 27.

## Open Business Questions
See DEVELOPMENT_PROGRESS.md.

## Exact Next Instruction
After the owner confirms the documents are in place: begin Phase 3 (architecture document, ERD, Prisma schema, API plan, permission matrix, order and delivery state machines, ledger design, socket registry) and ask for approval before writing any functional module.