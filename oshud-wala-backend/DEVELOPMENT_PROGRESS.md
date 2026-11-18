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
- [ ] Step 3: Pharmacy upgrade [3A locationId link DONE, 3A-2 owner link DONE] (owner login, multilingual names, images, services, opening hours, map)
- [ ] Step 4: Doctor global profile + PharmacyDoctor assignment
- [ ] Then: schedule, discovery, appointment, unavailability, receptionist/queue, catalogue/order, prescription, billing, rider, QR, OTP, payment/COD, earnings, wallet, rewards, announcements, notifications, reports, support/audit

## Tests
Previous "23 passed" claim is NOT verified: `establishment.test.ts` referenced a model/route that no longer exists. Test run results are recorded in TEST_REPORT.md only after the owner runs them.
