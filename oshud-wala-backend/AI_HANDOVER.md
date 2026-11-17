# AI Handover: Oshud Wala backend (updated 18 Nov 2026)

Read this file fully before writing any code.

## Owner rules (must follow)
1. Owner is Sounya Chatterjee. Reply in Banglish (Bengali written in English letters).
2. Build ONE small part at a time. After each part: write automated tests, owner runs them, they pass, then the next part.
3. Before starting a new Step: one full `npm run test:all` must be green.
4. Give ALL code and instructions as terminal commands to paste (cat > file <<'EOF', perl -pi). No zip files or downloads.
5. Owner uses macOS. Do NOT use `sed -i` (fails on Mac); use perl.
6. Explain code like a teacher to a beginner: start at the very first line and follow the order the code runs. Do not use Postman as the explanation.
7. If Postman steps are needed, give a full table: method, URL, token needed, body, expected result.
8. Never claim tests passed unless the owner pasted the output. Say clearly what you could not run.
9. If `prisma db push` warns about data loss, STOP and ask the owner.
10. Never ask for or print .env contents or secrets.

## Stack and layout
Node.js, Express, TypeScript, Prisma 5.22, Supabase PostgreSQL, Redis (BullMQ), Zod, JWT, Jest + supertest. Server runs on port 8000, Swagger at /docs.
Each module lives in src/modules/<name>/ with routes, controller, service, repository, validation.
New code must use the shared client: import { prisma } from '../../config/prisma'. Some older modules still create their own PrismaClient (to be fixed in a later step).
Best reference module for style: src/modules/location (audit log in transaction, whitelisted fields, zod validation).

## Done so far (all tests green, 8 suites / 50 tests)
- Step 0: secrets removed from git.
- Step 1: six roles only (see RoleName enum in prisma/schema.prisma), inventory/stock removed, security fixes.
- Step 2: Location master (/api/v1/locations, Super Admin manages, public sees active only).
- Step 3A: Pharmacy.locationId link. If locationId is sent, city/state/pincode are copied from Location. Old way (city + state + pincode) still works.

## Gotchas
- Tests run on the REAL Supabase database. Each suite uses its own phone range (5555555551-52 location, 71-73 step1, 81 pharmacy-location) and data prefixed "Test ", and cleans up. Use a new unused 55555555xx range per new suite.
- Per-suite scripts exist in package.json (test:step1, test:location, test:pharmacy-location, test:all).
- validate() middleware only checks, it does not apply zod defaults. Parse the query again in the controller if defaults are needed (see location.controller.ts).
- Decimal latitude/longitude come back as strings in JSON.
- No prisma/migrations folder; project uses `prisma db push` (risky for production, switch to migrations later).
- Old docs are outdated: HANDOVER.md, TEST_REPORT.md, and files in docs/ still describe the old Establishment design. Current docs: this file, DEVELOPMENT_PROGRESS.md, CHANGELOG.md, API_REGISTRY.md. Update CHANGELOG and API_REGISTRY every step.
- Known gaps: Socket.IO has no auth and cors is '*'; Dockerfile and docker-compose are empty; many module files (schedule, appointment, queue, wallet etc.) are 0-byte stubs.

## Next, in order
- 3A-2: Pharmacy owner link (PHARMACY role user linked to a pharmacy, probably via PharmacyStaff; read the model first)
- 3B: Bengali/Hindi pharmacy name
- 3C: logo, cover, gallery images
- 3D: Clinic/Medicine service toggle
- 3E: opening hours table and holidays
- 3F: map pin
- Step 4: Doctor global profile + PharmacyDoctor assignment
- Then: schedule, discovery, appointment, unavailability, receptionist/queue, catalogue/order, prescription, billing, rider, QR, OTP, payment/COD, earnings, wallet, rewards, announcements, notifications, reports, support/audit
