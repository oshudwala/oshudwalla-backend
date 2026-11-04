# Financial Ledger Design (Phase 3 draft)

## 1. Principles
1. Money is integer paise (BigInt in wallet and ledger tables).
2. The ledger is append-only. `ledger_entries` and `ledger_transactions` reject UPDATE and DELETE via DB trigger. Corrections are new reversing transactions.
3. A wallet balance changes only in the same DB transaction that inserts the matching ledger entries. Wallet balance columns are a cache; the ledger is the truth.
4. Every transaction is balanced: total credits equal total debits (deferred constraint trigger).
5. Every posting has an idempotency key. A replay returns the original result and changes nothing.
6. Postgres, not Redis, is authoritative.

## 2. Wallets (accounts)
| ownerKey | Meaning | May go negative |
|---|---|---|
| `CUSTOMER:<userId>` | Customer wallet (refunds, credits) | No |
| `RIDER:<userId>` | Rider earnings | No |
| `CLINIC:<clinicId>` | Clinic earnings | No |
| `PLATFORM:REVENUE` | Platform revenue and commission | Yes (internal) |
| `PLATFORM:RIDER_PAYOUT_EXPENSE` | Source of rider earnings | Yes (internal) |
| `PLATFORM:COD_CLEARING` | Cash owed to platform by riders | Yes (internal) |
| `PLATFORM:PAYOUT_CLEARING` | Counterpart for withdrawal payouts | Yes (internal) |

`balancePaise` = available. `heldPaise` = amount reserved for pending withdrawals.

## 3. Entry types and their effect
| Type | balance | held |
|---|---|---|
| CREDIT | + | = |
| DEBIT | - | = |
| HOLD | - | + |
| RELEASE | + | - |
| HOLD_CAPTURE | = | - (money leaves the wallet for payout) |

Each entry stores `balanceAfterPaise` and `heldAfterPaise` for audit and reconciliation.

## 4. Posting rules
| Event | txType | Entries | Idempotency key |
|---|---|---|---|
| Delivery completed | RIDER_EARNING | DEBIT PLATFORM:RIDER_PAYOUT_EXPENSE 4000, CREDIT RIDER:<id> 4000 (amount from settings, default Rs 40) | `rider-earning:<deliveryId>` |
| Rider collects COD | COD_COLLECTED | DEBIT PLATFORM:COD_CLEARING (receivable), CREDIT PLATFORM:REVENUE-side liability per final chart | `cod-collected:<orderId>` |
| Super Admin verifies cash deposit | COD_DEPOSIT_VERIFIED | Clears the rider's outstanding COD in `PLATFORM:COD_CLEARING` | `cod-deposit:<depositId>` |
| Withdrawal requested | WITHDRAWAL_HOLD | HOLD on requester wallet | `wd-hold:<withdrawalId>` |
| Withdrawal rejected / cancelled | WITHDRAWAL_RELEASE | RELEASE on requester wallet | `wd-release:<withdrawalId>` |
| Withdrawal paid | WITHDRAWAL_PAYOUT | HOLD_CAPTURE on requester wallet, CREDIT PLATFORM:PAYOUT_CLEARING | `wd-payout:<withdrawalId>` |
| Commission | COMMISSION | TBD, depends on commission decision | `commission:<orderId>` |
| Clinic pharmacy earnings | CLINIC_SETTLEMENT_CREDIT | TBD, depends on commission decision | `clinic-credit:<orderId>` |
| Refund | REFUND | TBD | `refund:<orderId>` |

COD cash is never credited to rider earnings. It lives in `cash_collections` / `cash_deposits` and, if you approve, in the platform clearing account for reconciliation only.

The COD, commission, clinic-credit and refund rows are marked TBD on purpose: they depend on business decisions not yet made (see "Decisions needed" below). The rider earning and withdrawal flows are fully specified.

## 5. Posting algorithm (one DB transaction)
1. Look up an existing `ledger_transactions` row by idempotency key. If found, return it (replay-safe).
2. Lock all involved wallets `SELECT ... FOR UPDATE ORDER BY id`.
3. Validate: sufficient available balance (or `allowNegative`), amounts > 0, entries balance.
4. Insert `ledger_transactions`, then the `ledger_entries` with `balanceAfter`/`heldAfter`.
5. Update the wallet rows (`balancePaise`, `heldPaise`, `version + 1`).
6. Insert an outbox event (wallet updated notification).
Any failure rolls everything back.

## 6. Withdrawal flow
1. Owner requests amount A (full or partial). Idempotency key required.
2. Transaction: lock wallet, require `balance >= A`, post HOLD, create `withdrawal_requests(REQUESTED)`.
3. Super Admin approves (APPROVED) or rejects (REJECTED -> RELEASE).
4. Super Admin records payout reference -> `settlements` row, post HOLD_CAPTURE, status PAID.

## 7. Reconciliation
Nightly job: for every wallet, `balance == SUM(CREDIT + RELEASE - DEBIT - HOLD)` and `held == SUM(HOLD - RELEASE - HOLD_CAPTURE)`. Any drift raises an alert and an audit record. Platform-wide, all transactions must net to zero.

## 8. Decisions needed from you
1. **Commission:** percentage, flat or per category, and charged to clinic pharmacy, platform pharmacy or both?
2. **Clinic earnings timing:** when is a clinic wallet credited for its pharmacy's order (at delivery, or after the rider's COD deposit is verified)?
3. **Customer wallet:** what can it be funded by (refunds only, coin conversion, admin credit)? COD-only checkout means no top-ups are assumed.
