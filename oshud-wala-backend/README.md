# Oshud Wala Backend

Enterprise-grade healthcare commerce, pharmacy, appointment and hyperlocal delivery platform.

> **Documentation status:** This README describes the **intended architecture and requirements**. At the time of writing, **only the folder structure exists. No application code is implemented.** Every feature below is marked with its implementation status in [Section 28](#28-implementation-status). Update this file whenever the real architecture or setup changes.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Business Requirements](#2-business-requirements)
3. [User Roles](#3-user-roles)
4. [Complete Features](#4-complete-features)
5. [Technology Stack](#5-technology-stack)
6. [Architecture](#6-architecture)
7. [Folder Structure](#7-folder-structure)
8. [Database Design](#8-database-design)
9. [Authentication and Authorization](#9-authentication-and-authorization)
10. [Business Workflows](#10-business-workflows)
11. [Order Lifecycle](#11-order-lifecycle)
12. [QR Pickup Verification](#12-qr-pickup-verification)
13. [In-App Delivery OTP](#13-in-app-delivery-otp)
14. [COD Collection](#14-cod-collection)
15. [Wallet, Ledger and Settlement](#15-wallet-ledger-and-settlement)
16. [Referral and Reward Coins](#16-referral-and-reward-coins)
17. [Coupon Management](#17-coupon-management)
18. [Socket.IO Events](#18-socketio-events)
19. [API Versioning and Conventions](#19-api-versioning-and-conventions)
20. [Environment Variables](#20-environment-variables)
21. [Local Development](#21-local-development)
22. [Supabase, Prisma, Redis and Docker Setup](#22-supabase-prisma-redis-and-docker-setup)
23. [Testing and Postman](#23-testing-and-postman)
24. [Deployment](#24-deployment)
25. [Security](#25-security)
26. [Development Process and Tracking Files](#26-development-process-and-tracking-files)
27. [Module Development Order](#27-module-development-order)
28. [Implementation Status](#28-implementation-status)

---

## 1. Project Overview

Oshud Wala is a commercial platform combining:

- **Medicine e-commerce**: search, cart, checkout (Cash on Delivery), prescription-based ordering.
- **Pharmacy management**: pharmacy-specific inventory, pharmacist review and order preparation.
- **Clinic and doctor management**: multi-clinic doctors, schedules, appointments, live queue.
- **Hyperlocal delivery**: rider assignment, QR pickup, in-app delivery OTP, COD cash handling.
- **Financial system**: wallets, immutable ledger, withdrawals, settlements, commissions.

It consists of three client experiences served by this single backend:

| Client | Users |
|---|---|
| Customer Website and Mobile App | Patients |
| Administrative Web Platform | Super Admin, Clinic Admin, Doctor, Pharmacist, Receptionist |
| Rider Mobile App | Riders |

This is a paid, industry-level product. Engineering quality targets large e-commerce platforms, adapted to healthcare.

## 2. Business Requirements

- Customers order medicines and upload prescriptions; payment is **Cash on Delivery**.
- A Super Admin-configured **Primary Pharmacy** handles orders and prescriptions where no clinic is chosen.
- Pharmacists verify prescription-dependent medicines before preparation.
- Doctors hold **one global profile** and work in **multiple clinics**. Schedules, fees and appointments are clinic-specific.
- Super Admin assigns ready orders to riders, one rider to many orders.
- Delivery completion requires a **customer OTP shown inside the Customer App** and entered inside the Rider App.
- Rider earns **₹40 per completed delivery**, credited exactly once.
- COD money is tracked separately from rider earnings.
- All money movements go through an immutable ledger.

## 3. User Roles

| Role | Scope |
|---|---|
| `SUPER_ADMIN` | Whole platform: configuration, rider assignment, settlements, approvals |
| `PATIENT` | Own profile, addresses, orders, prescriptions, appointments, wallet |
| `DOCTOR` | Own profile and appointments in clinics they are linked to |
| `PHARMACIST` | Own pharmacy only: orders, inventory, prescription review |
| `RIDER` | Own assigned deliveries, earnings, wallet, withdrawals |
| `RECEPTIONIST` | Own clinic only: appointments, queue, check-in |

Authorization has two layers: **RBAC** (what the role may do) and **resource-level authorization** (which records the user may touch). A Clinic Admin, Pharmacist, Rider or Receptionist can never access resources outside their authorized scope.

## 4. Complete Features

### Customer App
Medicine search, product categories, product details, cart, checkout (COD), prescription upload and tracking, doctor search, clinic search, doctor appointment, live queue, order tracking, in-app delivery OTP, referral coins, wallet, coupons, notifications, profile and address management.

### Administrative Web Platform
Separate dashboards for Super Admin, Clinic Admin, Doctor, Pharmacist and Receptionist.

### Rider App
Login, assigned orders, bulk delivery assignment, pickup location, QR scanner, navigation, customer OTP entry, COD collection, delivery history, earnings, wallet, withdrawal.

### Backend Modules (34 capabilities)
Authentication and RBAC, users and patients, addresses, super admin, clinics, clinic staff, doctors, specializations, doctor schedules, appointments, live queue, pharmacies, pharmacists, products, categories, pharmacy-specific inventory, prescriptions, cart, orders, riders, delivery, QR pickup verification, in-app delivery OTP, referrals, reward coins, coupons, wallets, withdrawals, settlements, cash collection, notifications, customer support, reports and analytics, audit logs.

Every module must contain real business logic, not only CRUD endpoints.

## 5. Technology Stack

| Area | Technology |
|---|---|
| Runtime / Language | Node.js, TypeScript |
| Framework | Express.js, REST API |
| Architecture | Modular Monolith |
| Database | Supabase PostgreSQL |
| ORM | Prisma (pooled runtime connection, direct migration connection) |
| Cache / Queue | Redis, BullMQ background workers |
| Realtime | Socket.IO |
| Auth | JWT access tokens, refresh token rotation, RBAC, bcrypt or Argon2id |
| Validation | Zod |
| Storage | Supabase Storage or S3-compatible private storage with signed URLs |
| Testing | Jest or Vitest, Supertest, Postman |
| Docs | Swagger / OpenAPI |
| DevOps | Docker, Git, structured logging, environment validation, CI/CD readiness |

Package versions are chosen for compatibility and stability, not "latest". Exact versions are recorded in `package.json` once Phase 4 is complete.

## 6. Architecture

### 6.1 Modular Monolith
A single deployable Express application organized into business modules. Each module owns its routes, controller, service, repository and validation. Modules communicate through service interfaces, not by reaching into each other's repositories. This keeps the option of extracting services later without paying microservice cost now.

### 6.2 Layering
```
Route  ->  Validation (Zod)  ->  Controller  ->  Service  ->  Repository  ->  Prisma / PostgreSQL
                                                   |
                                                   +-> Queue (BullMQ) / Socket.IO / Redis
```
- **Routes** wire middleware (auth, RBAC, rate limit, validation).
- **Controllers** handle HTTP only.
- **Services** hold business rules, state machines and transactions.
- **Repositories** are the only layer that talks to Prisma.

### 6.3 Source of Truth
- **PostgreSQL is the source of truth** for orders, stock, appointments, balances and ledger.
- **Redis** is used for caching, rate limiting, queues and Socket.IO scaling. It is **never** authoritative for financial balances or order state.

### 6.4 Reliability Principles
Idempotent APIs, strict order state machine, atomic financial transactions, transactional stock operations, background job retries, reliable event processing, audit trails, duplicate request prevention.

### 6.5 Concurrency Controls
Database transactions, unique constraints, row-level locking (`SELECT ... FOR UPDATE`) where required, and idempotency keys on mutating financial and order APIs. Detailed in the Phase 3 design documents.

## 7. Folder Structure

```
oshud-wala-backend/
├── src/
│   ├── app.ts            server.ts            routes.ts
│   ├── config/  middlewares/  utils/  validations/  jobs/  sockets/  docs/
│   └── modules/
│       ├── auth  admin  user  patient  address  clinic  clinicStaff  doctor
│       ├── receptionist  specialization  schedule  appointment  queue
│       ├── pharmacy  pharmacist  product  category  inventory  prescription
│       ├── cart  order  rider  delivery  pickupQr  deliveryOtp
│       ├── referral  coin  coupon  wallet  withdrawal  settlement
│       └── cashCollection  notification  support  report  audit
├── prisma/        schema.prisma  migrations/  seed.ts
├── tests/         unit/  integration/  concurrency/  helpers/
├── postman/       Oshud-Wala-API.postman_collection.json  environments/
├── scripts/  logs/  docs/  docker/
├── .env.example  .gitignore  Dockerfile  docker-compose.yml
├── tsconfig.json  package.json
└── README.md  DEVELOPMENT_PROGRESS.md  API_REGISTRY.md
    CHANGELOG.md  TEST_REPORT.md  HANDOVER.md
```

Standard module pattern:
```
moduleName/
├── moduleName.constants.ts
├── moduleName.controller.ts
├── moduleName.service.ts
├── moduleName.repository.ts
├── moduleName.routes.ts
└── moduleName.validation.ts
```
Extra files are created only when necessary.

## 8. Database Design

> The detailed ERD and Prisma schema are produced in **Phase 3** and require approval before implementation. This section states the rules they must follow.

- Supabase PostgreSQL accessed through Prisma.
- Proper relational design: foreign keys, unique constraints, composite indexes.
- **Money is stored as integer paise** (or `Decimal`), never floating point.
- Database transactions for multi-step operations.
- Connection pooling for runtime (Supabase pooler); **direct connection** for migrations.
- Safe migration strategy; backup and recovery considerations documented before launch.
- No credentials in frontend code. The Supabase **service role key is never exposed publicly**.
- Own multi-role authentication is used. Supabase Auth is not used unless a specific requirement justifies it.

Key integrity guarantees enforced at database level where possible:

| Guarantee | Mechanism (planned) |
|---|---|
| No negative inventory | CHECK constraint plus transactional decrement |
| No duplicate booking / overbooking | Unique constraints plus locked slot counters |
| No duplicate rider assignment | Unique constraint on active assignment per order |
| No duplicate delivery completion | State-machine guard plus unique constraint |
| No duplicate rider earnings | Unique ledger reference per order and entry type |
| No duplicate referral rewards | Unique constraint per referral and qualifying order |
| No duplicate financial transactions | Idempotency keys plus unique ledger references |

## 9. Authentication and Authorization

Planned design (Phase 5):

- Registration, login, logout, refresh, forgot password, reset password, change password.
- Short-lived **JWT access token**; **refresh tokens rotated** on every use, stored hashed, with reuse detection.
- Session management (list and revoke sessions).
- Password hashing with bcrypt or Argon2id.
- RBAC with seeded roles and permissions for all seven roles.
- Resource-level authorization (clinic, pharmacy, order ownership, rider assignment scope).
- Initial Super Admin created from secure environment variables during seeding.
- Rate limiting on authentication endpoints.

## 10. Business Workflows

### A. Medicine Ordering
Customer, Medicine Search, Product Details, Cart, Coupon / Referral Coins, COD Checkout, Primary Pharmacy, Pharmacist Review, Accept / Reject, Prepare Order, Ready for Pickup, Super Admin Rider Assignment, QR Pickup, Shipped, Delivery OTP, Delivered.

### B. Prescription Ordering
- Customer uploads a prescription.
- No clinic selected: routed to the Super Admin-configured **Primary Pharmacy**.
- Clinic selected: routed to that clinic, then follows the configured clinic and pharmacist review steps.
- A pharmacist verifies prescription-dependent medicines per applicable requirements.
- If customer confirmation or an updated quotation is needed, the order **waits for customer confirmation** before preparation.
- Prescription files live in private storage and are accessed only through short-lived signed URLs by authorized users.

### C. Doctor Appointment
Doctor Search, Clinic Selection, Schedule, Available Slot, Booking, Token Generation, Live Queue, Consultation. Concurrent requests must never overbook a slot.

### D. Rider Assignment
Super Admin selects one or more ready orders and assigns a rider. The rider gets an in-app notification. One rider may hold multiple deliveries. Duplicate or conflicting assignments are prevented.

### E. Live Queue
Per doctor, per clinic, per day. Token numbers are generated at booking; queue position and "now serving" are pushed over Socket.IO. Receptionist and doctor update queue status.

## 11. Order Lifecycle

> The authoritative state machine is in `docs/STATE_MACHINES.md` (Phase 3 draft, awaiting approval). Planned status flow:

```
PENDING_PHARMACY_REVIEW -> ACCEPTED -> PREPARING -> READY_FOR_PICKUP
       -> RIDER_ASSIGNED -> PICKED_UP -> SHIPPED -> DELIVERED

Side branches: REJECTED, CANCELLED, AWAITING_CUSTOMER_CONFIRMATION (prescription / quotation change),
               DELIVERY_FAILED -> SHIPPED (retry) | RETURNED
```

Rules:
- Transitions are validated by a central state machine; illegal transitions are rejected.
- Every transition is audit-logged with actor, time and reason.
- Stock is reserved and deducted transactionally.
- Final status names will be fixed in the Phase 3 approval.

## 12. QR Pickup Verification

The rider scans the QR shown by the pharmacy or clinic. The backend verifies:

1. QR token validity (signed / hashed).
2. Expiration.
3. Order or pickup batch match.
4. The scanning rider is the assigned rider.
5. Current order status permits pickup.
6. **Single use**: the token is consumed atomically.

Success moves the order to `PICKED_UP`. A QR can never be reused.

## 13. In-App Delivery OTP

**This is a mandatory, primary workflow. SMS-only OTP is not the primary flow.**

1. Rider reaches the customer.
2. Backend generates a secure, order-specific OTP.
3. Customer receives an in-app notification (no OTP in the push preview).
4. Customer opens Order Tracking; the OTP is displayed inside the authenticated Customer App.
5. Customer tells the rider the OTP.
6. Rider enters it inside the Rider App.
7. Backend verifies OTP, order, customer and assigned rider.
8. Success marks the order `DELIVERED`.
9. OTP becomes invalid.
10. Rider earns **₹40**, credited exactly once.
11. Customer, Rider and Super Admin receive delivery updates.

OTP requirements:
- Stored only as a **hash**.
- Configurable expiry and **limited attempts**.
- Bound to one order and the assigned rider.
- Readable only by the order-owning customer; **never exposed to the rider** or any unauthorized API.
- Never reusable.

Delivery uses Socket.IO for real-time updates plus persistent notifications for offline customers. An optional fallback for customers without app access may be designed later, but the in-app flow remains primary.

## 14. COD Collection

The backend records separately:

- Order payment amount
- Cash collected by rider
- Cash settlement pending
- Cash deposited
- Super Admin verification

**COD money is never rider earnings.**

## 15. Wallet, Ledger and Settlement

Separate accounts for **Customer, Clinic, Rider and Platform**.

Supported operations: credit, debit, hold, release, full and partial withdrawal, approval, rejection, cash settlement, commission, transaction history.

Rules:
- **Immutable, append-only ledger.** Entries are never updated or deleted; corrections are new reversing entries.
- No balance changes without a matching ledger entry, in the same database transaction.
- Idempotency keys prevent duplicate credits.
- Row-level locking prevents concurrent withdrawal overdraws.
- Balances are derived from, and reconcilable with, the ledger.

## 16. Referral and Reward Coins

- Referral code per customer.
- A referral reward is granted only after the referred user's **qualifying order** (exact qualification rule to be confirmed before this module).
- Reward granted **exactly once** per referral.
- Coins can be applied at a later checkout as a discount. Coin movements are ledgered.

## 17. Coupon Management

Admin-created coupons with validity window, usage limits (global and per user), minimum order value, discount type and caps. Redemption is transactional so usage limits hold under concurrency.

## 18. Socket.IO Events

> The full event registry is delivered in Phase 3. Rooms are scoped per user, order, clinic and queue to avoid broadcasting. Planned event families:

| Family | Examples (names provisional) |
|---|---|
| Order | `order:status_changed` |
| Delivery | `delivery:assigned`, `delivery:otp_ready`, `delivery:completed` |
| Queue | `queue:updated`, `queue:now_serving` |
| Notification | `notification:new` |

Sockets authenticate with the same JWT. Missed events are recoverable from persistent notifications and REST state endpoints after reconnect. The OTP value is never sent in a socket payload visible to anyone except the owning customer.

## 19. API Versioning and Conventions

- Base path: `/api/v1`
- JSON requests and responses with a consistent envelope (success flag, data, error code, message).
- Pagination on all list endpoints.
- Idempotency key header on critical mutating endpoints.
- All endpoints are tracked in `API_REGISTRY.md` and Swagger.

## 20. Environment Variables

> Final list is fixed in Phase 4 and validated at startup. Planned groups (names provisional):

| Group | Variables |
|---|---|
| App | `NODE_ENV`, `PORT`, `API_BASE_URL` |
| Database | `DATABASE_URL` (pooled), `DIRECT_URL` (migrations) |
| Redis | `REDIS_URL` |
| JWT | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL` |
| Super Admin seed | `SEED_SUPERADMIN_EMAIL`, `SEED_SUPERADMIN_PHONE`, `SEED_SUPERADMIN_PASSWORD` |
| Storage | `STORAGE_PROVIDER`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server only), bucket names |
| Delivery OTP | `DELIVERY_OTP_TTL_SECONDS`, `DELIVERY_OTP_MAX_ATTEMPTS` |
| QR | `PICKUP_QR_TTL_SECONDS`, `PICKUP_QR_SECRET` |
| Business | `RIDER_EARNING_PAISE` (default 4000) |

Real values go only in an untracked `.env`. `.env.example` contains placeholders only.

## 21. Local Development

> Not runnable yet. Setup begins in Phase 4. Planned flow:

```bash
cd "Vivek da/oshud-wala-backend"
cp .env.example .env        # fill in real values
npm install
npx prisma generate
npx prisma migrate dev
npm run seed
npm run dev
```

## 22. Supabase, Prisma, Redis and Docker Setup

- **Supabase:** create a project; use the pooler connection string for `DATABASE_URL` and the direct connection string for `DIRECT_URL`. Never commit keys.
- **Prisma:** `prisma/schema.prisma` defines the schema; migrations live in `prisma/migrations`; seeding via `prisma/seed.ts`.
- **Redis:** local instance via Docker or Homebrew; managed Redis in production.
- **Docker:** `Dockerfile` for the API and `docker-compose.yml` for local Redis (and optional local services).

Detailed, verified steps are added when Phase 4 is confirmed working.

## 23. Testing and Postman

- **Unit** tests for services and state machines.
- **Integration** tests with Supertest.
- **Concurrency** tests: slot booking, stock deduction, QR double scan, OTP double submit, concurrent withdrawals, referral and coupon races.
- **Postman**: `postman/Oshud-Wala-API.postman_collection.json` plus environments in `postman/environments/`.

A module counts as approved only after the project owner confirms: **`OK – ALL POSTMAN TESTS PASSED`**. Test results are recorded in `TEST_REPORT.md` and distinguish *code implemented*, *AI-verified*, *user-tested in Postman* and *production-verified*.

## 24. Deployment

> Not designed yet. Planned: containerized API and workers, managed Supabase PostgreSQL, managed Redis, environment-based configuration, CI/CD pipeline, health checks, structured logs, backup and recovery plan. Local test success will **not** be treated as production readiness; deployment, security assessment and real-world load testing are separate verification steps.

## 25. Security

Secure authentication, RBAC and resource-level permissions, rate limiting, Zod input validation, secure file upload (type and size checks, private storage, signed URLs), private prescription access, password hashing, refresh token rotation with reuse detection, hashed OTP with attempt limits, single-use QR tokens, audit logging, secrets only in environment variables, no service role key in any client.

## 26. Development Process and Tracking Files

Work proceeds step by step, module by module. Every module is: designed, modeled, coded, documented, Postman-tested by the owner, fixed if needed, approved, then recorded.

| File | Purpose |
|---|---|
| `README.md` | Complete project documentation |
| `DEVELOPMENT_PROGRESS.md` | Primary progress and continuity file |
| `API_REGISTRY.md` | Every endpoint and its status |
| `CHANGELOG.md` | Chronological changes |
| `TEST_REPORT.md` | Actual test results only |
| `HANDOVER.md` | State summary allowing a new conversation to continue |

## 27. Module Development Order

1. Authentication and RBAC
2. Users and Addresses
3. Super Admin
4. Clinic and Clinic Staff
5. Doctor and Specialization
6. Schedule
7. Appointment
8. Live Queue
9. Pharmacy and Pharmacist
10. Product and Category
11. Inventory
12. Prescription
13. Cart
14. Order
15. Rider
16. Delivery and QR Pickup
17. In-App Delivery OTP
18. Referral and Coins
19. Coupon
20. Wallet
21. Withdrawal and Settlement
22. Cash Collection
23. Notifications
24. Support
25. Reports and Analytics
26. Audit

## 28. Implementation Status

| Item | Status |
|---|---|
| Project folder structure | Created (empty placeholder files) |
| README and tracking documents | Created |
| Architecture, ERD, Prisma schema, state machines, ledger design, socket registry, permission matrix | Drafted in `docs/` and `prisma/schema.prisma`; schema passes Prisma syntax validation; **awaiting owner approval**; no migration run |
| Project setup (Express, Prisma, Redis, BullMQ, Socket.IO, Swagger, etc.) | Not started (Phase 4) |
| Authentication and RBAC | Not started (Phase 5) |
| All business modules | Not started |
| Automated tests | Not started |
| Postman collection | Empty placeholder |
| Deployment | Not started |

**Nothing in this repository has been tested or verified as of this document version.**
