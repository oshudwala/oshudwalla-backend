# Oshud Wala - Architecture (Phase 3 design draft, awaiting approval)

Status: DESIGN ONLY. Nothing here is implemented or tested.

## 1. Style
Modular monolith: one Express + TypeScript deployable, split into 36 business modules under `src/modules/`. Background work runs in separate worker processes from the same codebase (BullMQ). Module boundaries: a module may call another module's **service**, never its repository or Prisma models directly.

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
| Token number | `queue_days` row locked, `lastTokenIssued + 1`, unique (doctorClinic, date, token). |
| Stock | Reserve at order creation (`reservedQuantity += qty` with conditional update `WHERE quantity - reservedQuantity >= qty`), deduct on pickup/accept per final decision, release on cancel/reject. CHECK constraints prevent negatives. |
| Duplicate rider assignment | `deliveries.orderId` unique; assignment does conditional status update `READY_FOR_PICKUP -> RIDER_ASSIGNED`. |
| QR replay | Single conditional update `UPDATE pickup_qrs SET status='USED' WHERE tokenHash=? AND status='ACTIVE' AND expiresAt>now()`; zero rows = rejected. |
| OTP double submit | Lock the active OTP row; conditional status transition; delivery completion guarded by `deliveries.status`. |
| Duplicate rider earning | Ledger idempotency key `rider-earning:<deliveryId>` plus unique (txType, referenceType, referenceId). |
| Wallet concurrency | Lock wallet rows (ordered by id to avoid deadlock) inside the ledger-posting transaction. |
| Duplicate referral reward | `referrals.referredUserId` unique, `qualifyingOrderId` unique, coin transaction unique key. |
| Coupon limits | Conditional `usedCount` increment (`WHERE usedCount < usageLimitTotal`) plus per-user count inside the order transaction. |
| Replayed client requests | `idempotency_keys` table; `Idempotency-Key` header required on order create, appointment book, withdrawal request, delivery verify. |

## 5. Redis (never authoritative)
Rate limiting, short-TTL catalog and search caching, BullMQ queues, Socket.IO adapter (multi-instance), OTP/login attempt throttles. If Redis is flushed, the system must remain correct (only slower).

## 6. Background jobs (BullMQ queues)
| Queue | Jobs |
|---|---|
| `notifications` | Persist and push notifications, retry on failure |
| `outbox` | Poll `outbox_events`, dispatch to handlers (reliable event processing) |
| `maintenance` | Expire OTPs/QRs, expire prescriptions, purge idempotency keys and expired tokens, release stale stock reservations |
| `slots` | Generate `appointment_slots` ahead of time from schedules |
| `ledger-reconcile` | Verify wallet balances equal ledger sums, alert on drift |
| `reports` | Heavy report aggregation |

## 7. Events
Domain changes write an `outbox_events` row in the same transaction as the state change. A worker publishes it (Socket.IO, notifications). This avoids "state changed but nobody was told" and the reverse.

## 8. Database rules Prisma cannot express (raw SQL in migrations)
1. `inventory`: CHECK `quantity >= 0`, `reservedQuantity >= 0`, `reservedQuantity <= quantity`.
2. `appointment_slots`: CHECK `bookedCount >= 0 AND bookedCount <= capacity`.
3. `pharmacies`: partial unique index on `(isPrimary) WHERE isPrimary = true`.
4. `appointments`: partial unique `(patientId, slotId) WHERE status NOT IN ('CANCELLED','NO_SHOW')`.
5. `delivery_otps`: partial unique `(deliveryId) WHERE status = 'ACTIVE'`.
6. `wallets`: CHECK `balancePaise >= 0 AND heldPaise >= 0` unless `allowNegative`.
7. `ledger_entries`: CHECK `amountPaise > 0`; trigger rejecting UPDATE and DELETE on `ledger_entries` and `ledger_transactions`.
8. `coin_accounts`: CHECK `balance >= 0`.
9. `products`: `pg_trgm` GIN indexes on `name` and `genericName` for fast search.
10. Balanced-transaction check: deferred constraint trigger asserting entries of a `ledger_transaction` net to zero.

## 9. Authentication design
- Access token: JWT, 15 min, claims `sub`, `role`, `sid`.
- Refresh token: opaque random 256-bit value, stored only as SHA-256 hash, 30 days. Each refresh marks the old token used and issues a new one. A used token presented again revokes the whole session (reuse detection).
- Passwords: Argon2id (recommended over bcrypt; one library choice made in Phase 4).
- Lockout: 5 failed logins -> temporary lock; IP and account rate limits.
- Forgot password: single-use hashed token, 30 min expiry; success revokes all sessions.
- One role per user account (a doctor who is also a patient uses a separate account). Needs your confirmation.

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

## 13. API plan (module by module)
All paths under `/api/v1`. Roles: SA = Super Admin, CA = Clinic Admin, DR = Doctor, PH = Pharmacist, RC = Receptionist, RD = Rider, PT = Patient.

| # | Module | Key endpoints (summary) |
|---|---|---|
| 1 | Auth | POST register, login, logout, refresh, forgot-password, reset-password, change-password; GET sessions; DELETE sessions/:id |
| 2 | User/Address | GET/PATCH me; CRUD addresses; patient profile |
| 3 | Super Admin | users management, suspend/activate, platform settings (primary pharmacy, delivery fee, OTP/QR TTL), role-permission view |
| 4 | Clinic/Staff | CRUD clinics (SA); add/remove staff (CA, SA) |
| 5 | Doctor/Specialization | doctor onboarding, link to clinic with fee, specialization CRUD, doctor/clinic search (public) |
| 6 | Schedule | weekly schedule CRUD, exceptions, slot generation, list available slots |
| 7 | Appointment | book, cancel, reschedule, list, check-in, status updates |
| 8 | Queue | queue state, call next, pause/resume, patient queue position |
| 9 | Pharmacy/Pharmacist | CRUD pharmacy, set primary (SA), pharmacist onboarding |
| 10 | Product/Category | CRUD (SA/PH), public search and browse |
| 11 | Inventory | stock in/out/adjust, price, low stock, movements |
| 12 | Prescription | upload, list, signed-url view, clinic review, pharmacy verify, quotation, customer confirm |
| 13 | Cart | get, add, update, remove, validate |
| 14 | Order | checkout, list, detail, cancel, pharmacist accept/reject/prepare/ready |
| 15 | Rider | onboarding, KYC, status, location, my deliveries |
| 16 | Delivery/QR | assign (bulk), reassign, generate QR, verify QR, start trip, arrive, fail |
| 17 | Delivery OTP | customer read OTP, rider verify OTP, regenerate |
| 18 | Referral/Coins | my code, apply code, referral list, coin balance and history |
| 19 | Coupon | CRUD (SA), validate, apply |
| 20 | Wallet | my wallet, ledger history, admin views |
| 21 | Withdrawal/Settlement | request, list, approve, reject, mark paid |
| 22 | Cash collection | record collection, create deposit, verify deposit, discrepancy |
| 23 | Notification | list, mark read, register device token |
| 24 | Support | tickets, messages, assign, resolve |
| 25 | Reports | sales, orders, rider, clinic, financial summaries |
| 26 | Audit | search audit logs (SA) |

Detailed request/response contracts are written per module in `API_REGISTRY.md` at module time.
