# HANDOVER

Last updated: 2026-11-05 (Phase 3 design v2 delivered, awaiting approval)

## Purpose
Lets a new conversation or engineer continue without guessing. Requirements: the original Master Project Development Instruction (Parts 1 to 17) plus the owner's 2026-11-04 changes below.

## Current Project Architecture
Node.js, Express, TypeScript modular monolith. Supabase PostgreSQL with Prisma. Redis, BullMQ, Socket.IO, Firebase Cloud Messaging. Own JWT auth with refresh rotation and RBAC. Seven roles, one role per account: SUPER_ADMIN, PATIENT, ESTABLISHMENT_ADMIN (proposed rename of CLINIC_ADMIN), DOCTOR, PHARMACIST, RIDER, RECEPTIONIST. 34 module folders planned. **No application code exists yet.**

## Latest Project State
- Phases 1 and 2 done. Phase 3 v1 approved with defaults (2026-11-04). Phase 3 v2 (unified Establishment and notification system) delivered and **awaiting approval**.
- Design lives in `docs/` and `prisma/schema.prisma` (64 models, 42 enums, passes Prisma schema validation, not migrated).
- Start with `docs/DESIGN_CHANGES_V2.md`.

## Important Decisions
- Clinic and Pharmacy are ONE entity: `Establishment` with `EstablishmentService` rows (CLINIC, PHARMACY). Never duplicate records for one business. Clinic features (doctors, schedules, appointments, receptionists, queues) need an ACTIVE CLINIC service; pharmacy features (pharmacists, inventory, prescription verification, orders) need an ACTIVE PHARMACY service. Everything links to one `establishmentId`.
- Notifications: stored in PostgreSQL, pushed through FCM (iOS via FCM to APNs) for closed/background apps, Socket.IO for open apps, BullMQ retries, delivery logs, device-token lifecycle, preferences. Never put the OTP, QR tokens or sensitive data in push or socket payloads. Reminders live in `outbox_events`, not only in Redis.
- Own authentication, not Supabase Auth. Argon2id recommended (final choice in Phase 4).
- PostgreSQL is the source of truth; Redis never authoritative.
- Money: Int paise (orders), BigInt paise (wallet, ledger).
- Delivery OTP: HMAC hash plus AES-GCM ciphertext, readable only by the owning customer. Rider earns Rs 40 once via idempotent ledger posting; COD cash separate from earnings.
- Order statuses: PENDING_PHARMACY_REVIEW, AWAITING_CUSTOMER_CONFIRMATION, ACCEPTED, PREPARING, READY_FOR_PICKUP, RIDER_ASSIGNED, PICKED_UP, SHIPPED, DELIVERED, DELIVERY_FAILED, RETURNED, REJECTED, CANCELLED.
- A module is approved only when the owner says: `OK – ALL POSTMAN TESTS PASSED`.
- The owner requires: apply files, run, test, explicitly approve before the next phase starts.

## Current Database State
Schema drafted, not migrated. SQL constraints still to be written.

## Last Completed Module
Phase 3 design v2 (unapproved).

## Remaining Work
v2 approval, Phase 4 setup, Phase 5 authentication, then the modules in the revised order in README Section 27.

## Open Business Questions
See `DEVELOPMENT_PROGRESS.md`.

## Exact Next Instruction
Wait for the owner's reply on the five decisions in `DEVELOPMENT_PROGRESS.md` ("Decisions Needed From You (v2)"). Do not start Phase 4 before approval. Phase 4 then ships as a patch ZIP with install and run commands; the owner applies, runs, tests and approves before anything else.
