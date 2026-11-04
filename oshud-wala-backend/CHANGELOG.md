# CHANGELOG

Chronological record of features, code changes, bug fixes, database changes, breaking changes and API changes.

## 2026-11-05

### Changed (design v2, awaiting approval)
- Clinic and Pharmacy merged into one `Establishment` with `EstablishmentService` (CLINIC, PHARMACY), `EstablishmentStaff` and `DoctorEstablishment`. Removed models `Clinic`, `ClinicStaff`, `Pharmacy`, `PharmacyStaff`, `DoctorClinic`.
- Role `CLINIC_ADMIN` renamed `ESTABLISHMENT_ADMIN` (proposal).
- `Inventory`, `Order`, `PickupQr`, `Wallet`, `CommissionRule`, `Prescription` re-pointed to `establishmentId` (prescription has `sourceEstablishmentId` and `pharmacyEstablishmentId`).
- Wallet owner type `CLINIC` to `ESTABLISHMENT`; ledger type `CLINIC_SETTLEMENT_CREDIT` to `ESTABLISHMENT_SETTLEMENT_CREDIT`; `LedgerTransaction.serviceType` added.
- Socket rooms `clinic:{id}`/`pharmacy:{id}` to `est:{id}:clinic`/`est:{id}:pharmacy`.
- Module order: notification core moved after Authentication; `clinic`, `clinicStaff`, `pharmacy` modules replaced by `establishment` (proposal).

### Added (design v2, awaiting approval)
- Notification system design: `Notification` (rewritten), `NotificationDelivery`, `DeviceToken` (rewritten), `NotificationPreference`, `NotificationSetting`; `OutboxEvent` rewritten (dedupe key, aggregate cancel, scheduled reminders, CANCELLED status). Enum `NotificationType` replaced by `NotificationCategory`; new `NotificationPriority`, `NotificationChannel`, `NotificationDeliveryStatus`, `PushProvider`.
- `docs/DESIGN_CHANGES_V2.md`, `docs/ESTABLISHMENT.md`, `docs/NOTIFICATIONS.md`.
- Schema totals: 64 models, 42 enums; passes Prisma schema validation.

### Database Changes
Schema designed only. No migration created or run.

### API Changes
None implemented. Planned endpoints documented in `docs/ESTABLISHMENT.md` and `docs/NOTIFICATIONS.md`.

### Breaking Changes
Design-level only: v1 table and role names above are replaced. Nothing was migrated, so no data is affected.

## 2026-11-04

### Approved
- Phase 3 v1 design approved by the owner "with defaults".

## 2026-11-03

### Added
- Phase 1: project folder structure under `Vivek da/oshud-wala-backend/`.
- Phase 2: README.md, DEVELOPMENT_PROGRESS.md, API_REGISTRY.md, CHANGELOG.md, TEST_REPORT.md, HANDOVER.md.
- Phase 3 v1: architecture, ERD, state machines, ledger design, permission matrix, socket registry, Prisma schema.

### Fixed
- Prisma schema draft: added missing `auditLogs` relation on `User` (found by schema validation).
