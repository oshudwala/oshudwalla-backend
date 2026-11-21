# CHANGELOG

Chronological record of features, code changes, bug fixes, database changes, breaking changes and API changes.

## 2026-11-18 (Step 3B-2: Pharmacy profile update)
- Added PUT /api/v1/pharmacies/:id. Super Admin edits any pharmacy, a PHARMACY user edits only the pharmacy where they are an active OWNER (else 403). Editable: name, nameBn, nameHi, phone, line1, line2, latitude+longitude (together, null clears the pin). status, isPrimary, city and locationId are ignored. Audit logged as PHARMACY_UPDATED.

## 2026-11-18 (Step 3B: Bengali and Hindi pharmacy name)
- Added nullable Pharmacy.nameBn and Pharmacy.nameHi (2 to 100 characters). POST /api/v1/pharmacies/admin-create accepts them and pharmacy lists and /my return them.

## 2026-11-18 (Step 3B: Bengali and Hindi pharmacy name)
- Added nullable Pharmacy.nameBn and Pharmacy.nameHi (2 to 100 characters). POST /api/v1/pharmacies/admin-create accepts them and pharmacy lists and /my return them.

## 2026-11-18 (Step 3A-3: Pharmacy + owner account)
- POST /api/v1/pharmacies/admin-create now creates the pharmacy and its owner login in one transaction (ownerName, ownerEmail, ownerPassword, phone, locationId, line1, optional latitude+longitude). Duplicate phone or email gives 409. Password is hashed and never returned.
- Removed POST /api/v1/pharmacies/:id/owner. Kept GET /api/v1/pharmacies/my.
- Tests: pharmacy-create (19) and pharmacy (5) replace pharmacy-owner and pharmacy-location.

## /2026-11-18 (Step 3A-3: Pharmacy + owner account)
- POST /api/v1/pharmacies/admin-create now creates the pharmacy and its owner login in one transaction (ownerName, ownerEmail, ownerPassword, phone, locationId, line1, optional latitude+longitude). Duplicate phone or email gives 409. Password is hashed and never returned.
- Removed POST /api/v1/pharmacies/:id/owner. Kept GET /api/v1/pharmacies/my.
- Tests: pharmacy-create (19) and pharmacy (5) replace pharmacy-owner and pharmacy-location.

## 2026-11-18 (Step 3A-2: Pharmacy owner link)
- Added POST /api/v1/pharmacies/:id/owner (Super Admin links a PHARMACY role user as OWNER via PharmacyStaff, audit logged, duplicate and second-owner protection) and GET /api/v1/pharmacies/my (PHARMACY user sees only own pharmacies).
- Role is never changed by this endpoint. No schema change.
- POST /api/v1/pharmacies/admin-create now also accepts locationId (city, state, pincode optional when locationId is given).

## 2026-11-18 (Step 3A: Pharmacy location link)
- Added nullable locationId on Pharmacy linked to Location. When locationId is given, city, state and pincode are copied from the Location master. Old way (city, state, pincode) still works.
- Pharmacy repository now uses shared prisma client and an explicit field whitelist (no body spread).

## 2026-11-18 (Step 2: Location master)
- Added `Location` model (`locations` table), `src/config/prisma.ts` shared Prisma client, `/api/v1/locations` module (public active list, Super Admin create/update/activate/deactivate, audit logged, duplicate protection).
- Hard delete intentionally not provided (locations will be referenced by pharmacies/appointments).

## 2026-11-18 (Step 0 + Step 1)

### Security
- `.env` removed from git tracking and ignored; `.env.example` sanitized. Secrets must be rotated.
- Doctor onboarding restricted to SUPER_ADMIN (PHARMACY_ADMIN could add doctors to any pharmacy).
- Doctor onboarding no longer converts non-PATIENT accounts (e.g. SUPER_ADMIN) into DOCTOR.
- Seed creates Super Admin from env (no hard-coded password); `make-admin.ts` removed.
- Raw DB error messages no longer returned to clients in pharmacy/doctor services.

### Changed
- Roles reduced to six: PHARMACY replaces PHARMACY_ADMIN and PHARMACIST. `PharmacyStaffRole` is now OWNER, RECEPTIONIST.
- Removed Inventory, StockMovement, StockMovementType (out of approved scope). `pharmacistNote` renamed `reviewNote` (same DB column).
- Removed empty modules pharmacist, clinic, clinicStaff, inventory; removed duplicate `bcryptjs`.
- `establishment.test.ts` replaced by `pharmacy.test.ts` (old test referenced a non-existent model).

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

## [Step 3B-3] - 2026-11-20
### Added
- `PUT /api/v1/pharmacies/admin-update/:id` (SUPER_ADMIN only) to change a pharmacy's `locationId` or `status` (`ACTIVE` / `SUSPENDED`).
- Syncs `city`, `state`, and `pincode` automatically when `locationId` changes; prevents suspending the Primary Pharmacy.
- Audit log action `PHARMACY_ADMIN_UPDATED` inside transaction.
- Automated Jest suite `tests/integration/pharmacy-admin-update.test.ts` (15 tests) and `npm run test:pharmacy-admin-update` script.

## [Step 3C] - 2026-11-21
### Added
- `coverUrl` and `galleryUrls` fields on `Pharmacy`.
- `PUT /api/v1/pharmacies/:id/media` (SUPER_ADMIN & own PHARMACY owner) with HTTP/HTTPS URL validation, max 10 gallery images, and `PHARMACY_MEDIA_UPDATED` audit log.
- Automated Jest suite `tests/integration/pharmacy-media.test.ts` (12 tests).

## [Step 3D] - 2026-11-21
### Added
- `hasClinicService` (default `false`) and `hasMedicineService` (default `true`) on `Pharmacy`.
- `PUT /api/v1/pharmacies/:id/services` (SUPER_ADMIN & own PHARMACY owner) preventing disabling both services simultaneously, with `PHARMACY_SERVICES_UPDATED` audit log.
- Automated Jest suite `tests/integration/pharmacy-services.test.ts` (12 tests).

## [Step 3E] - 2026-11-21
### Added
- `PharmacyOpeningHour` and `PharmacyHoliday` tables in Prisma schema.
- `GET /api/v1/pharmacies/:id/hours`, `PUT /api/v1/pharmacies/:id/hours`, `POST /api/v1/pharmacies/:id/holidays`, `DELETE /api/v1/pharmacies/:id/holidays/:holidayId` with audit logs.
- Automated Jest suite `tests/integration/pharmacy-hours.test.ts` (12 tests).

## [Step 3G] - 2026-11-21
### Added
- `POST /api/v1/pharmacies/:id/receptionists`, `GET /api/v1/pharmacies/:id/receptionists`, and `PATCH /api/v1/pharmacies/:id/receptionists/:staffId/status` (SUPER_ADMIN & own PHARMACY owner).
- Creates `RECEPTIONIST` user + `PharmacyStaff` row in one transaction with `RECEPTIONIST_CREATED` and `RECEPTIONIST_STATUS_UPDATED` audit logs.
- Automated Jest suite `tests/integration/pharmacy-receptionist.test.ts` (10 tests).

## [Auth OTP] - 2026-11-21
### Added
- `src/utils/apitxt.util.ts` for APITXT SMS OTP (without DLT) with dry-run in test mode.
- `POST /api/v1/auth/send-otp`, `POST /api/v1/auth/register-otp`, `POST /api/v1/auth/login-otp/send`, `POST /api/v1/auth/login-otp/verify` (PATIENT role only for OTP login).
- Switched `auth.repository.ts` to shared `prisma` client and updated `API_REGISTRY.md`.
- Automated Jest suite `tests/integration/auth-otp.test.ts` (9 tests).

## [Auth OTP] - 2026-11-21
### Added
- `src/utils/apitxt.util.ts` for APITXT SMS OTP (without DLT) with dry-run in test mode.
- `POST /api/v1/auth/send-otp`, `POST /api/v1/auth/register-otp`, `POST /api/v1/auth/login-otp/send`, `POST /api/v1/auth/login-otp/verify` (PATIENT role only for OTP login).
- Switched `auth.repository.ts` to shared `prisma` client and updated `API_REGISTRY.md`.
- Automated Jest suite `tests/integration/auth-otp.test.ts` (9 tests).

## [Step 5] - 2026-11-21
### Added
- `src/modules/schedule/` mounted at `/api/v1/schedules` (weekly schedules, exceptions, automated slot generation up to 31 days, slot status toggle).
- Automated Jest suite `tests/integration/schedule.test.ts` (9 tests).
