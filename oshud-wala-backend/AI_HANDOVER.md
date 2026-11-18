# AI Handover: Oshud Wala backend (updated 18 Nov 2026)

Read this file fully before writing any code. Then read DEVELOPMENT_PROGRESS.md and CHANGELOG.md.

## Owner rules (must follow)
1. Owner is Soumya Chatterjee. Reply in Banglish (Bengali written in English letters).
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

## Done so far (owner reported all green; expected 10 suites / 84 tests)
- Step 0: secrets removed from git tracking (.env must NOT be tracked; owner must rotate secrets and make the repo private, ask the owner to confirm).
- Step 1: six roles only (see RoleName enum in prisma/schema.prisma), inventory/stock removed, security fixes.
- Step 2: Location master (/api/v1/locations, Super Admin manages, public sees active only).
- Step 3A: Pharmacy.locationId link. If locationId is sent, city/state/pincode are copied from Location. Old way (city + state + pincode) still works.
- Step 3A-3 (replaced 3A-2): Super Admin creates a pharmacy AND its owner account in one transaction via POST /api/v1/pharmacies/admin-create (ownerName, ownerEmail, ownerPassword, phone, locationId, line1, optional latitude+longitude). Owner user gets role PHARMACY and a PharmacyStaff OWNER row, audit log PHARMACY_CREATED. Owner logs in with email or phone and GET /api/v1/pharmacies/my returns only own pharmacies. The old POST /:id/owner endpoint was deleted. Map pin (latitude/longitude) is saved here, so 3F backend part is done.
- Step 3B: Pharmacy.nameBn and Pharmacy.nameHi (nullable, 2 to 100 chars) accepted on admin-create and returned in pharmacy lists and /my. Editing names after creation comes with the pharmacy profile update part.
- Step 3B-2: PUT /api/v1/pharmacies/:id (roles SUPER_ADMIN and PHARMACY). Super Admin edits any pharmacy, a PHARMACY user only the pharmacy where they are an active OWNER (else 403). Editable: name, nameBn, nameHi, phone, line1, line2, latitude+longitude (together, null clears the pin). Extra fields (status, isPrimary, city, locationId) are ignored. Audit log PHARMACY_UPDATED. Pharmacy.phone is the shop phone, it does not change the owner login phone.
- Step 3B: Pharmacy.nameBn and Pharmacy.nameHi (nullable, 2 to 100 chars) accepted on admin-create and returned in pharmacy lists and /my. Editing names after creation comes with the pharmacy profile update part.

## Gotchas
- Tests run on the REAL Supabase database. Each suite uses its own phone range and data prefixed "Test ", and cleans up. Used so far: 5555555551-52 (location), 71-73 (step1-roles), 81 (pharmacy-location), 5555555601-02 and 55555566xx (pharmacy-create), 5555557001-02 and 55555571xx (pharmacy). Use a new unused 55555555xx range per new suite. Also used: 5555555611 and 55555567xx (pharmacy-names). Also used: 5555555611 and 55555567xx (pharmacy-names). Also used: 5555555621-22 and 55555568xx (pharmacy-update).
- Per-suite scripts exist in package.json (test:step1, test:location, test:pharmacy, test:pharmacy-create, test:pharmacy-names, test:pharmacy-update, test:pharmacy-names, test:all).
- After a role change, log in again before using the token, tokens carry the role.
- validate() middleware only checks, it does not apply zod defaults. Parse the query again in the controller if defaults are needed (see location.controller.ts).
- GET /api/v1/pharmacies requires login (router.use(authenticate)), even though an old comment says public.
- Decimal latitude/longitude come back as strings in JSON.
- No prisma/migrations folder; project uses `prisma db push` (risky for production, switch to migrations later).
- Old docs are outdated: README.md (says no code exists), HANDOVER.md, TEST_REPORT.md, and files in docs/ still describe the old Establishment design. Current docs: this file, DEVELOPMENT_PROGRESS.md, CHANGELOG.md, API_REGISTRY.md.
- Known gaps: Socket.IO has no auth and cors is '*'; Dockerfile and docker-compose are empty; many module files (schedule, appointment, queue, wallet etc.) are 0-byte stubs; older modules still use their own PrismaClient.

## Next, in order
- 3B-2: pharmacy profile update (owner edits own pharmacy names, address, map pin; Super Admin edits any; audit logged)
- 3B-3: Super Admin changes a pharmacy locationId or status (suspend/activate), audit logged
- 3C: logo, cover, gallery images
- 3D: Clinic/Medicine service toggle
- 3E: opening hours table and holidays
- 3G: pharmacy owner creates own Receptionist (RECEPTIONIST role user + PharmacyStaff RECEPTIONIST row); receptionist later manages doctor queue
- Step 4: Doctor global profile + PharmacyDoctor assignment
- Then: schedule, discovery, appointment, unavailability, receptionist/queue, catalogue/order, prescription, billing, rider, QR, OTP, payment/COD, earnings, wallet, rewards, announcements, notifications, reports, support/audit

