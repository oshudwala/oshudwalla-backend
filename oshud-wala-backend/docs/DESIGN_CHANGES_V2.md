# Design v2: Conflict Check and Change Summary

Status: DESIGN ONLY, awaiting owner approval. Nothing here is implemented.

Basis: Phase 3 v1 was approved on 2026-11-04 "with defaults". Two changes were requested the same day: (1) Clinic and Pharmacy become one unified Establishment; (2) a production-grade push notification system. This document lists every conflict with the v1 approval and what changed.

## 1. Conflicts with the v1 approval and how they are resolved

| # | v1 approved design | Conflict | v2 resolution | Needs your decision? |
|---|---|---|---|---|
| 1 | Separate `clinics` and `pharmacies` tables, `clinic_staff`, `pharmacy_staff` | Directly contradicts the unified requirement | Replaced by `establishments`, `establishment_services`, `establishment_staff`. No duplicate records per business. | No (requested) |
| 2 | Role `CLINIC_ADMIN` (one of the seven roles in your spec) | A clinic-named role cannot administer a pharmacy too | Renamed to `ESTABLISHMENT_ADMIN`. Still seven roles. | **Yes**: confirm the rename (alternative: keep the name `CLINIC_ADMIN` but let it administer both) |
| 3 | `doctor_clinics` | Doctors link to a clinic | Renamed `doctor_establishments`; requires an ACTIVE CLINIC service on that establishment | No |
| 4 | Part 6 / module list: "Clinic Management, Clinic Staff, Pharmacy Management" as separate modules (folders `clinic`, `clinicStaff`, `pharmacy`) | Separate modules imply separate entities | One `establishment` module (profile, registration, services, staff). `clinic`, `clinicStaff`, `pharmacy` folders are retired (empty today). Clinic behaviour lives in doctor/schedule/appointment/queue/receptionist; pharmacy behaviour in pharmacist/inventory/prescription/order. 36 module folders become 34. | **Yes**: confirm (folder change is applied with the Phase 4 patch) |
| 5 | Prescription had `clinicId` + `pharmacyId` | Two entity types | `sourceEstablishmentId` (patient's choice) + `pharmacyEstablishmentId` (responsible pharmacy service). See `ESTABLISHMENT.md` section 6. | Open question 4 below |
| 6 | Wallet `CLINIC:<id>`, ledger type `CLINIC_SETTLEMENT_CREDIT` | Clinic-named | `ESTABLISHMENT:<id>`, `ESTABLISHMENT_SETTLEMENT_CREDIT`; ledger transactions carry `serviceType` for per-service reporting | **Yes**: one wallet per establishment (my recommendation) vs separate clinic and pharmacy wallets |
| 7 | Socket rooms `clinic:{id}`, `pharmacy:{id}` | Two entity types | `est:{id}:clinic`, `est:{id}:pharmacy` | No |
| 8 | Module order: Notifications was #23 | Every module emits notifications, and push needs sessions and device tokens | Notification **core** moves to right after Authentication; later modules just emit events. A hardening step (broadcast, stats, load test) stays near the end. | **Yes**: this changes your Part 14 order |
| 9 | Redis "never authoritative" and reminders | Delayed BullMQ jobs live only in Redis; a flush would lose reminders | Reminders are stored in `outbox_events` (`availableAt`), a Redis flush loses nothing | No |
| 10 | `notifications`, `device_tokens` tables (v1) | Too thin for delivery logs, preferences, multi-device, invalid-token cleanup | Extended; see `NOTIFICATIONS.md` | No (requested) |
| 11 | `NotificationType` enum | Missing PAYMENT, SECURITY, ESTABLISHMENT | Renamed `NotificationCategory`, extended | No |
| 12 | Previous security, concurrency and testing requirements | None | Unchanged. Added: device-token ownership rules, no secrets in push, idempotent notification creation (`userId + dedupeKey`), retry/failure handling | No |

Not in conflict: OTP design, order and delivery state machines, ledger principles, SHIPPED naming, stock and cancellation rules. Only names of the actors changed ("pharmacist of that establishment's pharmacy service").

## 2. Schema change summary (`prisma/schema.prisma`)
- Removed models: `Clinic`, `ClinicStaff`, `Pharmacy`, `PharmacyStaff`, `DoctorClinic`.
- Added models: `Establishment`, `EstablishmentService`, `EstablishmentStaff`, `DoctorEstablishment`, `NotificationDelivery`, `NotificationPreference`, `NotificationSetting`.
- Rewritten: `Notification`, `DeviceToken`, `OutboxEvent`.
- Re-pointed to `establishmentId`: `Inventory`, `Order`, `PickupQr`, `Wallet`, `CommissionRule`, `Prescription` (two columns).
- Enum changes: `RoleName.CLINIC_ADMIN` to `ESTABLISHMENT_ADMIN`; `ClinicStaffRole` removed; `NotificationType` replaced by `NotificationCategory`; `WalletOwnerType.CLINIC` to `ESTABLISHMENT`; new `ServiceType`, `ServiceStatus`, `EstablishmentStaffRole`, `NotificationPriority`, `NotificationChannel`, `NotificationDeliveryStatus`, `PushProvider`; `OutboxStatus.CANCELLED` added.
- Totals: 64 models, 42 enums. Passes the Prisma schema validator. Not migrated; no database connected.

## 3. Open questions (unchanged ones plus new)
1. Referral qualifying-order rule.
2. Commission model.
3. When an establishment wallet is credited for pharmacy orders (delivery or after COD deposit verified).
4. Prescription routing when the patient picks an establishment that has **no** pharmacy service: Super Admin picks a pharmacy, or system auto-forwards to the Primary Pharmacy? (Draft assumes Super Admin picks; auto-forward is a one-line change.)
5. Can a doctor change their own fee, or only the Establishment Admin?
6. What funds the customer wallet?
7. New: self-registration. Can a business apply through the public app (status PENDING, Super Admin approves each service), or does only Super Admin create establishments? Draft supports both.
8. New: FCM project ownership. You will create the Firebase project and supply credentials before real push can be tested (see `NOTIFICATIONS.md` section 12).
