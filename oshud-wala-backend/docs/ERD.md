# Oshud Wala - Entity Relationship Diagram (design v2)

Rendered by any Mermaid viewer (GitHub, VS Code Mermaid extension). Only keys and relationships are shown; full columns are in `prisma/schema.prisma` (64 models, 42 enums). Clinic and Pharmacy are one `ESTABLISHMENT`.

## 1. Identity and access
```mermaid
erDiagram
  ROLE ||--o{ USER : has
  ROLE ||--o{ ROLE_PERMISSION : grants
  PERMISSION ||--o{ ROLE_PERMISSION : in
  USER ||--o{ SESSION : opens
  SESSION ||--o{ REFRESH_TOKEN : rotates
  USER ||--o{ PASSWORD_RESET_TOKEN : requests
  USER ||--o| PATIENT_PROFILE : has
  USER ||--o{ ADDRESS : owns
  USER ||--o| DOCTOR_PROFILE : has
  USER ||--o| RIDER_PROFILE : has
```

## 2. Unified establishment, staff, doctors
```mermaid
erDiagram
  ESTABLISHMENT ||--o{ ESTABLISHMENT_SERVICE : "enables CLINIC / PHARMACY"
  ESTABLISHMENT ||--o{ ESTABLISHMENT_STAFF : employs
  USER ||--o{ ESTABLISHMENT_STAFF : "works as"
  DOCTOR_PROFILE ||--o{ DOCTOR_SPECIALIZATION : has
  SPECIALIZATION ||--o{ DOCTOR_SPECIALIZATION : in
  DOCTOR_PROFILE ||--o{ DOCTOR_ESTABLISHMENT : "practices at"
  ESTABLISHMENT ||--o{ DOCTOR_ESTABLISHMENT : hosts
```

## 3. Clinic service: schedule, appointments, queue
```mermaid
erDiagram
  DOCTOR_ESTABLISHMENT ||--o{ DOCTOR_SCHEDULE : has
  DOCTOR_ESTABLISHMENT ||--o{ SCHEDULE_EXCEPTION : has
  DOCTOR_ESTABLISHMENT ||--o{ APPOINTMENT_SLOT : generates
  DOCTOR_ESTABLISHMENT ||--o{ QUEUE_DAY : runs
  APPOINTMENT_SLOT ||--o{ APPOINTMENT : holds
  DOCTOR_ESTABLISHMENT ||--o{ APPOINTMENT : for
  USER ||--o{ APPOINTMENT : books
```

## 4. Pharmacy service: catalog, stock, prescriptions, cart, orders
```mermaid
erDiagram
  CATEGORY ||--o{ CATEGORY : parent_of
  CATEGORY ||--o{ PRODUCT : contains
  ESTABLISHMENT ||--o{ INVENTORY : stocks
  PRODUCT ||--o{ INVENTORY : stocked_as
  INVENTORY ||--o{ STOCK_MOVEMENT : logs
  USER ||--o| CART : has
  CART ||--o{ CART_ITEM : contains
  PRODUCT ||--o{ CART_ITEM : in
  USER ||--o{ PRESCRIPTION : uploads
  ESTABLISHMENT ||--o{ PRESCRIPTION : "source (patient's choice)"
  ESTABLISHMENT ||--o{ PRESCRIPTION : "pharmacy verifier"
  PRESCRIPTION ||--o{ PRESCRIPTION_FILE : has
  PRESCRIPTION ||--o{ PRESCRIPTION_ITEM : lists
  PRESCRIPTION ||--o{ PRESCRIPTION_STATUS_HISTORY : tracks
  USER ||--o{ ORDER : places
  ESTABLISHMENT ||--o{ ORDER : fulfils
  PRESCRIPTION ||--o{ ORDER : backs
  ORDER ||--o{ ORDER_ITEM : contains
  PRODUCT ||--o{ ORDER_ITEM : sold_as
  ORDER ||--o{ ORDER_STATUS_HISTORY : tracks
```

## 5. Delivery, cash, wallet, ledger
```mermaid
erDiagram
  DELIVERY_BATCH ||--o{ DELIVERY : groups
  ORDER ||--o| DELIVERY : delivered_by
  USER ||--o{ DELIVERY : rides
  DELIVERY ||--o{ DELIVERY_STATUS_HISTORY : tracks
  DELIVERY ||--o{ DELIVERY_OTP : verifies_with
  ORDER ||--o{ DELIVERY_OTP : for
  DELIVERY_BATCH ||--o{ PICKUP_QR : pickup_via
  ESTABLISHMENT ||--o{ PICKUP_QR : shows
  ORDER ||--o| CASH_COLLECTION : collected_as
  CASH_DEPOSIT ||--o{ CASH_COLLECTION : covers
  CASH_DEPOSIT ||--o| SETTLEMENT : settled_by
  WALLET ||--o{ LEDGER_ENTRY : records
  LEDGER_TRANSACTION ||--o{ LEDGER_ENTRY : groups
  WALLET ||--o{ WITHDRAWAL_REQUEST : requests
  WITHDRAWAL_REQUEST ||--o| SETTLEMENT : settled_by
  USER ||--o{ WALLET : owns
  ESTABLISHMENT ||--o| WALLET : owns
  ESTABLISHMENT ||--o{ COMMISSION_RULE : has
```

## 6. Notifications
```mermaid
erDiagram
  USER ||--o{ NOTIFICATION : receives
  NOTIFICATION ||--o{ NOTIFICATION_DELIVERY : "delivery log"
  USER ||--o{ DEVICE_TOKEN : registers
  SESSION ||--o{ DEVICE_TOKEN : "linked to"
  DEVICE_TOKEN ||--o{ NOTIFICATION_DELIVERY : "target of"
  USER ||--o{ NOTIFICATION_PREFERENCE : sets
  USER ||--o| NOTIFICATION_SETTING : has
```
`outbox_events` (standalone) feeds notifications and holds scheduled reminders.

## 7. Growth, support, platform
```mermaid
erDiagram
  USER ||--o{ REFERRAL : refers
  USER ||--o| REFERRAL : referred_by
  USER ||--o| COIN_ACCOUNT : has
  COIN_ACCOUNT ||--o{ COIN_TRANSACTION : logs
  COUPON ||--o{ COUPON_REDEMPTION : redeemed_in
  ORDER ||--o| COUPON_REDEMPTION : uses
  USER ||--o{ SUPPORT_TICKET : opens
  SUPPORT_TICKET ||--o{ SUPPORT_MESSAGE : contains
  USER ||--o{ AUDIT_LOG : acts_in
```

Standalone tables: `idempotency_keys`, `outbox_events`, `platform_settings`.
