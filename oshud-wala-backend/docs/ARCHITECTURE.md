# Oshud Wala - Architecture (Phase 3 design v2, awaiting approval)

Status: DESIGN ONLY. Nothing here is implemented or tested.

v2 changes: Clinic and Pharmacy are one unified `Establishment` (see `ESTABLISHMENT.md`) and notifications are a full push + in-app system (see `NOTIFICATIONS.md`). Conflict check against the v1 approval: `DESIGN_CHANGES_V2.md`.

## 1. Style
Modular monolith: one Express + TypeScript deployable, split into 34 business modules under `src/modules/` (clinic and pharmacy are one `establishment` module). Background work runs in separate worker processes from the same codebase (BullMQ). Module boundaries: a module may call another module's **service**, never its repository or Prisma models directly.

## 2. Request pipeline
```
request -> requestId + structured logger -> helmet/cors -> rate limit (Redis)
        -> body parse (size limits) -> authenticate (JWT) -> authorize (RBAC permission)
        -> resource-scope check (clinic / pharmacy / ownership / assignment)
        -> Zod validation -> idempotency middleware (mutating critical routes)
        -> controller -> service (business rules + DB transaction) -> repository
        -> response envelope / global error handler
```

Response envelope:
```json
{ "success": true, "data": {}, "meta": { "page": 1, "limit": 20, "total": 0 } }
{ "success": false, "error": { "code": "ORDER_INVALID_TRANSITION", "message": "...", "details": [] } }
```

## 3. Layer responsibilities
| Layer | Does | Must not |
|---|---|---|
| Route | Compose middleware | Business logic |
| Controller | Parse request, call service, shape response | Touch Prisma |
| Service | Rules, state machines, transactions, emitting events | Know about HTTP |
| Repository | Prisma queries only | Business decisions |

## 4. Concurrency and integrity patterns
| Risk | Pattern |
|---|---|
| Slot overbooking | In one transaction: `SELECT ... FOR UPDATE` on the `appointment_slots` row, check `bookedCount < capacity`, increment, insert appointment. DB CHECK as backstop. |
| Token number | `queue_days` row locked, `lastTokenIssued + 1`, unique (doctorEstablishment, date, token). |
| Stock | Pharmacy-service stock keyed by establishment. Reserve at order creation (`reservedQuantity += qty` with conditional update `WHERE quantity - reservedQuantity >= qty`), deduct on pickup/accept per final decision, release on cancel/reject. CHECK constraints prevent negatives. |
| Duplicate rider assignment | `deliveries.orderId` unique; assignment does conditional status update `READY_FOR_PICKUP -> RIDER_ASSIGNED`. |
| QR replay | Single conditional update `UPDATE pickup_qrs SET status='USED' WHERE tokenHash=? AND status='ACTIVE' AND expiresAt>now()`; zero rows = rejected. |
| OTP double submit | Lock the active OTP row; conditional status transition; delivery completion guarded by `deliveries.status`. |
| Duplicate rider earning | Ledger idempotency key `rider-earning:<deliveryId>` plus unique (txType, referenceType, referenceId). |
| Wallet concurrency | Lock wallet rows (ordered by id to avoid deadlock) inside the ledger-posting transaction. |
| Duplicate referral reward | `referrals.referredUserId` unique, `qualifyingOrderId` unique, coin transaction unique key. |
| Coupon limits | Conditional `usedCount` increment (`WHERE usedCount < usageLimitTotal`) plus per-user count inside the order transaction. |
| Duplicate notification | `UNIQUE (userId, dedupeKey)` on `notifications`; BullMQ `jobId` = notification/delivery id; retries are no-ops. |
| Outbox double processing | Dispatcher claims rows with `SELECT ... FOR UPDATE SKIP LOCKED`; handlers idempotent via `dedupeKey`. |
| Device token hijack / shared phone | Token globally unique; registering an existing token moves it to the new user in one transaction and deactivates the old owner's row. |
| Two Primary Pharmacies | Partial unique index on `establishments(isPrimaryPharmacy) WHERE true`; change runs in one transaction. |
| Service disabled while work is open | Disable runs in a transaction that counts open appointments/orders/prescriptions and refuses if any exist. |
| Replayed client requests | `idempotency_keys` table; `Idempotency-Key` header required on order create, appointment book, withdrawal request, delivery verify. |

## 5. Redis (never authoritative)
Rate limiting, short-TTL catalog and search caching, BullMQ queues, Socket.IO adapter (multi-instance), OTP/login attempt throttles. If Redis is flushed, the system must remain correct (only slower).

## 6. Background jobs (BullMQ queues)
| Queue | Jobs |
|---|---|
| `notification-fanout`, `notification-push` | Resolve recipients, store notifications, emit sockets, send FCM push with retries (see `NOTIFICATIONS.md`) |
| `outbox` | Poll due `outbox_events` (including scheduled reminders), dispatch to handlers (reliable event processing) |
| `maintenance` | Expire OTPs/QRs, expire prescriptions, purge idempotency keys and expired tokens, release stale stock reservations, notification sweeper (re-enqueue stuck deliveries), stale device-token cleanup, delivery-log retention |
| `slots` | Generate `appointment_slots` ahead of time from schedules |
| `ledger-reconcile` | Verify wallet balances equal ledger sums, alert on drift |
| `reports` | Heavy report aggregation |

## 7. Events
Domain changes write an `outbox_events` row in the same transaction as the state change. A worker publishes it (Socket.IO, notifications). This avoids "state changed but nobody was told" and the reverse. Scheduled work such as appointment reminders is stored the same way (`availableAt` in the future, `dedupeKey`, cancelled via `aggregateType/aggregateId` when the appointment is cancelled), so a Redis flush cannot lose it.

## 8. Database rules Prisma cannot express (raw SQL in migrations)
1. `inventory`: CHECK `quantity >= 0`, `reservedQuantity >= 0`, `reservedQuantity <= quantity`.
2. `appointment_slots`: CHECK `bookedCount >= 0 AND bookedCount <= capacity`.
3. `establishments`: partial unique index on `(isPrimaryPharmacy) WHERE isPrimaryPharmacy = true`.
4. `appointments`: partial unique `(patientId, slotId) WHERE status NOT IN ('CANCELLED','NO_SHOW')`.
5. `delivery_otps`: partial unique `(deliveryId) WHERE status = 'ACTIVE'`.
6. `wallets`: CHECK `balancePaise >= 0 AND heldPaise >= 0` unless `allowNegative`.
7. `ledger_entries`: CHECK `amountPaise > 0`; trigger rejecting UPDATE and DELETE on `ledger_entries` and `ledger_transactions`.
8. `coin_accounts`: CHECK `balance >= 0`.
9. `products`: `pg_trgm` GIN indexes on `name` and `genericName` for fast search.
10. Balanced-transaction check: deferred constraint trigger asserting entries of a `ledger_transaction` net to zero.
11. `notification_deliveries`: partial unique index on `(notificationId, channel) WHERE deviceTokenId IS NULL` (socket rows).
12. `device_tokens`: token uniqueness is global (`UNIQUE token`), reassignment done in a transaction.

## 9. Authentication design
- Access token: JWT, 15 min, claims `sub`, `role`, `sid`.
- Refresh token: opaque random 256-bit value, stored only as SHA-256 hash, 30 days. Each refresh marks the old token used and issues a new one. A used token presented again revokes the whole session (reuse detection).
- Passwords: Argon2id (recommended over bcrypt; one library choice made in Phase 4).
- Lockout: 5 failed logins -> temporary lock; IP and account rate limits.
- Forgot password: single-use hashed token, 30 min expiry; success revokes all sessions.
- One role per user account (a doctor who is also a patient uses a separate account). Approved 2026-11-04.

## 10. Storage
Private bucket for prescriptions. Upload validated (MIME sniffing, size limit, allowed types jpeg/png/pdf), SHA-256 stored, only `storageKey` kept in DB. Access via signed URLs (5 min) issued after authorization checks. Service role key stays server-side only.

## 11. Delivery OTP design
- OTP: 6 digits from a CSPRNG. Stored as `otpHash` (HMAC-SHA256 with server secret) for verification, plus `otpCiphertext` (AES-256-GCM) so the owning customer can re-read it in-app after refresh or reconnect.
- Customer reads via `GET /api/v1/orders/:id/delivery-otp` (PATIENT who owns the order only). Rider endpoints never return it.
- Socket and push carry only "OTP ready for order X", never the code.
- Defaults (configurable): expiry 15 min, 5 attempts. On lock or expiry the rider can request regeneration, which supersedes the old OTP.
- Success: one transaction marks delivery and order DELIVERED, OTP VERIFIED, and posts the Rs 40 ledger earning (idempotent).
- Design decision for approval: storing a reversible encrypted copy is required for in-app display; the hash alone cannot be shown to the customer.

## 12. Observability
Pino structured JSON logs with requestId, no secrets or OTPs in logs, `/health` (liveness) and `/ready` (DB + Redis), audit log for sensitive actions.

## 13. API plan (module by module, v2)
All paths under `/api/v1`. Roles: SA = Super Admin, EA = Establishment Admin, DR = Doctor, PH = Pharmacist, RC = Receptionist, RD = Rider, PT = Patient. Establishment and notification endpoints are specified in `ESTABLISHMENT.md` section 8 and `NOTIFICATIONS.md` section 10.

| # | Module (new order) | Key endpoints (summary) |
|---|---|---|
| 1 | Auth | POST register, login, logout, refresh, forgot-password, reset-password, change-password; GET sessions; DELETE sessions/:id |
| 2 | Notification core | devices (register, refresh, delete, list); notifications (list, unread-count, read, read-all, ack); preferences; admin delivery log and retry; fan-out and push workers |
| 3 | User/Address | GET/PATCH me; CRUD addresses; patient profile |
| 4 | Super Admin | users management, suspend/activate, platform settings, primary pharmacy, role-permission view |
| 5 | Establishment (unified) | register/apply, admin create, approve/suspend, services (request, approve, pause, settings), staff CRUD, public search, my establishments |
| 6 | Doctor/Specialization | doctor onboarding, link to establishment (CLINIC service) with fee, specialization CRUD, doctor/establishment search |
| 7 | Schedule | weekly schedule CRUD, exceptions, slot generation, list available slots |
| 8 | Appointment | book, cancel, reschedule, list, check-in, status updates (+ reminders via outbox) |
| 9 | Queue | queue state, call next, pause/resume, patient queue position |
| 10 | Pharmacist / pharmacy service | pharmacist onboarding (staff), pharmacy service settings, accepting-orders toggle |
| 11 | Product/Category | CRUD (SA/PH), public search and browse |
| 12 | Inventory | stock in/out/adjust, price, low stock, movements (per establishment, PHARMACY service) |
| 13 | Prescription | upload, list, signed-url view, clinic review, pharmacy verify, quotation, customer confirm, routing |
| 14 | Cart | get, add, update, remove, validate |
| 15 | Order | checkout, list, detail, cancel, pharmacist accept/reject/prepare/ready |
| 16 | Rider | onboarding, KYC, status, location, my deliveries |
| 17 | Delivery/QR | assign (bulk), reassign, generate QR, verify QR, start trip, arrive, fail |
| 18 | Delivery OTP | customer read OTP, rider verify OTP, regenerate |
| 19 | Referral/Coins | my code, apply code, referral list, coin balance and history |
| 20 | Coupon | CRUD (SA), validate, apply |
| 21 | Wallet | my wallet, ledger history, admin views |
| 22 | Withdrawal/Settlement | request, list, approve, reject, mark paid |
| 23 | Cash collection | record collection, create deposit, verify deposit, discrepancy |
| 24 | Support | tickets, messages, assign, resolve |
| 25 | Notification hardening | broadcast, stats, load and failure tests |
| 26 | Reports | sales, orders, rider, establishment (per service), financial summaries |
| 27 | Audit | search audit logs (SA) |

Detailed request/response contracts are written per module in `API_REGISTRY.md` at module time.

## 14. Notifications (summary)
Fan-out through BullMQ, FCM push for closed or background apps (iOS through FCM to APNs), Socket.IO for open apps, every notification stored, delivery log per attempt, device-token lifecycle and invalid-token cleanup, preferences, retries and failure handling. Details, event catalog and test plan: `NOTIFICATIONS.md`.
