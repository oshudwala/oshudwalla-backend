# OSHUD WALA DEVELOPMENT PROGRESS

Source of truth for business rules: the Master Project Development Prompt (six roles, unified PHARMACY, no inventory).

## Status
IN DEVELOPMENT. Re-baselined after repo audit (18 Nov 2026). Earlier "Establishment" design is superseded: the code uses a single `Pharmacy` entity.

## Implemented (code exists)
- Auth: register, login, refresh (rotation), logout
- Notification core: device tokens, preferences, BullMQ push worker
- User profile + addresses
- Super Admin: user role/status, platform settings
- Specialization, Doctor onboarding (Super Admin only), Pharmacy create/list/set-primary (Super Admin)

## Re-baseline steps (current)
- [x] Step 0: secrets out of git (.env ignored), rotate secrets (OWNER ACTION)
- [x] Step 1: six-role migration, remove inventory/stock, cleanup, doc sync
- [x] Step 2: Location master
- [ ] Step 3: Pharmacy upgrade [3A locationId link DONE, 3A-3 pharmacy + owner account in one step DONE, 3B Bengali/Hindi name DONE, 3B-2 pharmacy profile update DONE, 3B Bengali/Hindi name DONE] (owner login, multilingual names, images, services, opening hours, map)
- [ ] Step 4: Doctor global profile + PharmacyDoctor assignment
- [ ] Then: schedule, discovery, appointment, unavailability, receptionist/queue, catalogue/order, prescription, billing, rider, QR, OTP, payment/COD, earnings, wallet, rewards, announcements, notifications, reports, support/audit

## Tests
Previous "23 passed" claim is NOT verified: `establishment.test.ts` referenced a model/route that no longer exists. Test run results are recorded in TEST_REPORT.md only after the owner runs them.

- **Step 3B-3 (2026-11-20)**: Added `PUT /api/v1/pharmacies/admin-update/:id` (SUPER_ADMIN only) to update pharmacy `locationId` (syncs city/state/pincode from active Location) and `status` (`ACTIVE`/`SUSPENDED`, blocks suspending Primary Pharmacy), with `PHARMACY_ADMIN_UPDATED` audit log and 15 Jest integration tests.

- **Step 3C (2026-11-21)**: Added `coverUrl` and `galleryUrls` to `Pharmacy` and `PUT /api/v1/pharmacies/:id/media` (SUPER_ADMIN & own PHARMACY owner) with `PHARMACY_MEDIA_UPDATED` audit log and 12 Jest tests.

- **Step 3D (2026-11-21)**: Added `hasClinicService` and `hasMedicineService` to `Pharmacy` and `PUT /api/v1/pharmacies/:id/services` (SUPER_ADMIN & own PHARMACY owner; at least one service must remain enabled) with `PHARMACY_SERVICES_UPDATED` audit log and 12 Jest tests.

- **Step 3E (2026-11-21)**: Added `PharmacyOpeningHour` & `PharmacyHoliday` models and `GET/PUT /:id/hours`, `POST /:id/holidays`, `DELETE /:id/holidays/:holidayId` with audit logs and 12 Jest tests.

- **Step 3G (2026-11-21)**: Added Pharmacy Receptionist management (`POST/GET /:id/receptionists`, `PATCH /:id/receptionists/:staffId/status`) with `RECEPTIONIST` role login, audit logs, and 10 Jest tests. Step 3 (Pharmacy Upgrade) complete.

- **Auth OTP (2026-11-21)**: Added APITXT (without DLT) + Redis OTP for Patient registration (`/send-otp`, `/register-otp`) and Patient-only OTP login (`/login-otp/send`, `/login-otp/verify`), rate limit 3/min, SHA-256 hash, shared Prisma client in `auth.repository.ts`, and 9 Jest tests.

- **Auth OTP (2026-11-21)**: Added APITXT (without DLT) + Redis OTP for Patient registration (`/send-otp`, `/register-otp`) and Patient-only OTP login (`/login-otp/send`, `/login-otp/verify`), rate limit 3/min, SHA-256 hash, shared Prisma client in `auth.repository.ts`, and 9 Jest tests.

- **Step 5 (2026-11-21)**: Added Doctor weekly schedules, LEAVE/MODIFIED_HOURS exceptions, idempotent slot generation (respects pharmacy holidays & leaves), slot OPEN/BLOCKED toggle, and 9 Jest tests.

- **Step 5 (2026-11-21)**: Added Doctor weekly schedules, LEAVE/MODIFIED_HOURS exceptions, idempotent slot generation (respects pharmacy holidays & leaves), slot OPEN/BLOCKED toggle, and 9 Jest tests.
