# AI Handover: Oshud Wala backend (updated 18 Nov 2026)

Read this file fully before writing any code. Then read DEVELOPMENT_PROGRESS.md and CHANGELOG.md.

## Owner rules (must follow)
1. Owner is Sounya Chatterjee. Reply in Banglish (Bengali written in English letters).
2. Build ONE small part at a time. After each part: write automated tests, owner runs them, they pass, then the next part.
3. Before starting a new Step: one full `npm run test:all` must be green.
4. Give ALL code and instructions as terminal commands to paste (cat > file <<'EOF', perl -pi). No zip files or downloads.
5. Owner uses macOS. Do NOT use `sed -i` (fails on Mac); use perl.
6. Explain code like a teacher to a beginner: start at the very first line and follow the order the code runs. Do not use Postman as the explanation.
7. If Postman steps are needed, give a full table: method, URL, token needed, body, expected result. Default is automated Jest tests.
8. Never claim tests passed unless the owner pasted the output. Say clearly what you could not run.
9. If `prisma db push` warns about data loss, STOP and ask the owner.
10. Never ask for or print .env contents or secrets.
11. Before writing code for a part, read the existing files it touches (ask the owner to `cat` them) and tell the owner in short what you will change.
12. At the end of every part, give the commands to update DEVELOPMENT_PROGRESS.md, CHANGELOG.md, API_REGISTRY.md and this file, then the git commit and push commands. When code, tests, docs and commit commands are ALL delivered, end the message with the line: **Done sesh**. Do not write "Done sesh" earlier.

## Stack and layout
Node.js, Express, TypeScript, Prisma 5.22, Supabase PostgreSQL, Redis (BullMQ), Zod, JWT, Jest + supertest. Server runs on port 8000, Swagger at /docs.
Each module lives in src/modules/<name>/ with routes, controller, service, repository, validation.
New code must use the shared client: import { prisma } from '../../config/prisma'. Some older modules still create their own PrismaClient (to be fixed in a later step).
Best reference modules for style: src/modules/location and src/modules/pharmacy (audit log in transaction, whitelisted fields, zod validation).

## Done so far (owner reported all green; expected 9 suites / 62 tests)
- Step 0: secrets removed from git tracking (.env must NOT be tracked; owner must rotate secrets and make the repo private, ask the owner to confirm).
- Step 1: six roles only (see RoleName enum in prisma/schema.prisma), inventory/stock removed, security fixes.
- Step 2: Location master (/api/v1/locations, Super Admin manages, public sees active only).
- Step 3A: Pharmacy.locationId link. If locationId is sent, city/state/pincode are copied from Location. Old way (city + state + pincode) still works.
- Step 3A-2: Pharmacy owner link. POST /api/v1/pharmacies/:id/owner (Super Admin, body {userId}) creates a PharmacyStaff row with staffRole OWNER. User must already have the PHARMACY role (role is never changed here). One active owner per pharmacy. GET /api/v1/pharmacies/my (PHARMACY role) returns only own pharmacies. PharmacyStaffRole enum has only OWNER and RECEPTIONIST.

## Gotchas
- Tests run on the REAL Supabase database. Each suite uses its own phone range and data prefixed "Test ", and cleans up. Used so far: 5555555551-52 (location), 71-73 (step1-roles), 81 (pharmacy-location), 91-94 (pharmacy-owner). Use a new unused 55555555xx range per new suite.
- Per-suite scripts exist in package.json (test:step1, test:location, test:pharmacy-location, test:pharmacy-owner, test:all).
- After a role change, log in again before using the token, tokens carry the role.
- validate() middleware only checks, it does not apply zod defaults. Parse the query again in the controller if defaults are needed (see location.controller.ts).
- GET /api/v1/pharmacies requires login (router.use(authenticate)), even though an old comment says public.
- Decimal latitude/longitude come back as strings in JSON.
- No prisma/migrations folder; project uses `prisma db push` (risky for production, switch to migrations later).
- Old docs are outdated: README.md (says no code exists), HANDOVER.md, TEST_REPORT.md, and files in docs/ still describe the old Establishment design. Current docs: this file, DEVELOPMENT_PROGRESS.md, CHANGELOG.md, API_REGISTRY.md.
- Known gaps: Socket.IO has no auth and cors is '*'; Dockerfile and docker-compose are empty; many module files (schedule, appointment, queue, wallet etc.) are 0-byte stubs; older modules still use their own PrismaClient.

## Next, in order
- 3B: Bengali/Hindi pharmacy name (nullable name fields, schema change with db push, tests)
- 3C: logo, cover, gallery images
- 3D: Clinic/Medicine service toggle
- 3E: opening hours table and holidays
- 3F: map pin
- Step 4: Doctor global profile + PharmacyDoctor assignment
- Then: schedule, discovery, appointment, unavailability, receptionist/queue, catalogue/order, prescription, billing, rider, QR, OTP, payment/COD, earnings, wallet, rewards, announcements, notifications, reports, support/audit

## CURRENT STATUS (in progress, not finished): Step 3A-3
Owner decision: Super Admin creates a pharmacy AND the owner account in ONE step (no separate link step). Flow: Super Admin creates Pharmacy (with owner login) -> Pharmacy owner creates own Receptionist (planned 3G) -> Receptionist manages doctor queue.

Pharmacy create form (owner's design): Logo, English name*, Bengali name, Hindi name, Owner name*, Owner email*, Account password*, Phone, Location (city dropdown from Location master), State, PIN, Street address, live map pin (frontend sends latitude/longitude).

3A-3 plan (code NOT yet applied in the repo; the last attempt failed because the new files were never pasted):
1. POST /api/v1/pharmacies/admin-create body: name*, ownerName*, ownerEmail*, ownerPassword* (8-72 chars), phone* (10-15 digits), locationId* (city/state/pincode copied from Location), line1*, optional line2, latitude+longitude (together), isPrimary.
2. One Prisma transaction: create owner User (role PHARMACY, bcrypt hash, same phone/email), create Pharmacy (explicit field whitelist), create PharmacyStaff row (OWNER), audit log PHARMACY_CREATED. Duplicate phone/email -> 409 (also map Prisma P2002 to 409). Never return password or hash.
3. Delete the old POST /api/v1/pharmacies/:id/owner endpoint (assignOwner in service, assignOwnerSchema, controller, route) and its test file tests/integration/pharmacy-owner.test.ts. Keep GET /api/v1/pharmacies/my.
4. Replace tests/integration/pharmacy-location.test.ts with tests/integration/pharmacy-create.test.ts (about 19 tests) and rewrite tests/integration/pharmacy.test.ts to the new body. Use the shared prisma client. Restore the real Primary pharmacy after tests.
5. User model facts: User has roleId (relation to Role), email (unique, optional), phone (unique), passwordHash, fullName. Register code is in src/modules/auth (bcrypt, 10 rounds). RoleName enum: SUPER_ADMIN, PATIENT, PHARMACY, DOCTOR, RECEPTIONIST, RIDER. PharmacyStaff has userId, pharmacyId, staffRole (OWNER or RECEPTIONIST), isActive, unique(userId, pharmacyId).
6. Then 3B (nameBn, nameHi), 3C (logo), 3G (owner creates Receptionist), later wallet withdrawals (request -> Super Admin approves -> amount held then debited, ledger entry).

Security TODO for the owner (ask to confirm): .env was committed in the past, so rotate DB password, JWT secrets, Redis password, and make the GitHub repo private (currently public).
