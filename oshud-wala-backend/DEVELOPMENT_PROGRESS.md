# OSHUD WALA DEVELOPMENT PROGRESS

## Project Status
IN DEVELOPMENT. Phase 3 design v2 delivered, **AWAITING OWNER APPROVAL**. Phase 4 has NOT started.

## Completed Phases
- [x] Phase 1: Project folder structure (confirmed by user, 2026-11-03)
- [x] Phase 2: README.md and tracking documents (placed by user, 2026-11-03)
- [x] Phase 3 v1: Architecture and database design (approved with defaults by user, 2026-11-04)
- [ ] Phase 3 v2: Revision for unified Establishment and notification system (delivered 2026-11-05, NOT yet approved)

## Current Phase
Phase 3 v2 review. Per the owner's instruction, Phase 4 starts only after v2 is approved, and no later phase starts until the owner has applied the files, run the project, tested it and explicitly approved.

## What changed in v2 (owner request, 2026-11-04)
1. **Unified Establishment**: Clinic and Pharmacy are one entity with CLINIC and/or PHARMACY services. One registration, one admin team, one dashboard. See `docs/ESTABLISHMENT.md`.
2. **Production notification system**: FCM push (Android; iOS through FCM to APNs), in-app history, Socket.IO for open apps, device tokens (multi-device, refresh, invalid-token cleanup), BullMQ retries, delivery logs, preferences, event catalog. See `docs/NOTIFICATIONS.md`.
3. Conflict check against v1: `docs/DESIGN_CHANGES_V2.md`.

## Phase 3 v2 Deliverables (status: DELIVERED, NOT APPROVED)
| File | Notes |
|---|---|
| `docs/DESIGN_CHANGES_V2.md` | Conflict check, change summary, open questions |
| `docs/ESTABLISHMENT.md` | Unified establishment design |
| `docs/NOTIFICATIONS.md` | Notification design, event catalog, test plan |
| `docs/ARCHITECTURE.md`, `ERD.md`, `STATE_MACHINES.md`, `LEDGER_DESIGN.md`, `PERMISSION_MATRIX.md`, `SOCKET_EVENTS.md` | Updated for v2 |
| `prisma/schema.prisma` | 64 models, 42 enums |

Verification actually performed: the schema was run through Prisma's schema validator (WASM build) and passes. **No migration has been run, no database is connected, no SQL-level constraints exist yet, and no notification has ever been sent.** Real push delivery can only be verified by the owner with a Firebase project and real devices.

## Decisions Approved (v1, 2026-11-04, "approve with defaults")
OTP stored as HMAC hash plus AES-GCM ciphertext readable only by the owning customer; one role per account; order status `SHIPPED`; stock reserved at checkout, deducted at PICKED_UP, released on reject/cancel; customer cancels until PREPARING, Super Admin until PICKED_UP; OTP generated when rider marks ARRIVED; Int paise for orders, BigInt paise for wallet/ledger; actor columns in history tables are plain UUIDs.

## Decisions Needed From You (v2)
1. Rename role `CLINIC_ADMIN` to `ESTABLISHMENT_ADMIN` (still seven roles).
2. Retire module folders `clinic`, `clinicStaff`, `pharmacy`; add `establishment` (34 module folders). Applied with the Phase 4 patch.
3. One wallet per establishment, with ledger entries tagged by service (recommended), or separate clinic and pharmacy wallets.
4. Move notification core to right after Authentication (changes your Part 14 order).
5. Allow public self-registration of establishments (PENDING, Super Admin approves each service) in addition to Super Admin creation.

## Completed Modules
- [x] Project Structure
- [x] README
- [x] Phase 3 design (v1 approved; v2 pending)

## Pending Modules (revised order, pending approval)
- [ ] Phase 3 v2 approval
- [ ] Project Setup (Phase 4)
- [ ] Authentication and RBAC
- [ ] Notification core
- [ ] Users and Addresses
- [ ] Super Admin
- [ ] Establishment (unified)
- [ ] Doctor and Specialization
- [ ] Schedule
- [ ] Appointment
- [ ] Live Queue
- [ ] Pharmacist and pharmacy service settings
- [ ] Product and Category
- [ ] Inventory
- [ ] Prescription
- [ ] Cart
- [ ] Order
- [ ] Rider
- [ ] Delivery and QR Pickup
- [ ] In-App Delivery OTP
- [ ] Referral and Coins
- [ ] Coupon
- [ ] Wallet
- [ ] Withdrawal and Settlement
- [ ] Cash Collection
- [ ] Support
- [ ] Notification hardening
- [ ] Reports and Analytics
- [ ] Audit

## Files Created
- Phase 1: folder structure with empty placeholders
- Phase 2: README.md, DEVELOPMENT_PROGRESS.md, API_REGISTRY.md, CHANGELOG.md, TEST_REPORT.md, HANDOVER.md
- Phase 3 v1: docs/ARCHITECTURE.md, ERD.md, STATE_MACHINES.md, LEDGER_DESIGN.md, PERMISSION_MATRIX.md, SOCKET_EVENTS.md, prisma/schema.prisma
- Phase 3 v2: docs/DESIGN_CHANGES_V2.md, docs/ESTABLISHMENT.md, docs/NOTIFICATIONS.md

## Files Modified (v2)
README.md, DEVELOPMENT_PROGRESS.md, CHANGELOG.md, HANDOVER.md, prisma/schema.prisma, docs/ARCHITECTURE.md, ERD.md, STATE_MACHINES.md, LEDGER_DESIGN.md, PERMISSION_MATRIX.md, SOCKET_EVENTS.md

## Database Migrations
None

## APIs Implemented
None

## Tests
- Executed: 0
- Passed: 0
- Failed: 0
- Schema syntax validation (AI-verified, not a functional test): PASS

## User Approval Status
Phase 3 v1: approved with defaults (2026-11-04). Phase 3 v2: pending. No code module approved (none exists).

## Open Business Questions (asked before the affected module)
1. Referral qualifying-order rule
2. Commission model (percentage, flat or per category; charged to whom?)
3. When an establishment wallet is credited for pharmacy orders (at delivery or after COD deposit verified)
4. Prescription to a clinic-only establishment: Super Admin chooses pharmacy, or auto-forward to Primary Pharmacy?
5. Can a Doctor change their own consultation fee, or only the Establishment Admin?
6. What funds the customer wallet?
7. Firebase project, Android package name, iOS bundle id, APNs key and service account: owner provides before real push testing (not needed to start Phase 4)

## Known Issues
- Ledger posting rules for COD, commission, establishment credit and refund are TBD until the business questions are answered.
- Real push delivery (killed app, background, iOS Focus, battery saver) is unverifiable without the owner's devices.

## Next Step
Owner reviews `docs/DESIGN_CHANGES_V2.md` first, then replies with approval or changes (five decisions above). Then Phase 4: project setup, delivered as a patch ZIP with install and run commands; the owner applies, runs and tests it and must explicitly approve before anything else starts.
