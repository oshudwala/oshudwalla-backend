# Role Permission Matrix (Phase 3 draft)

Legend: **A** = all records, **O** = own records only, **C** = own clinic(s) only, **P** = own pharmacy only, **R** = assigned rider records only, **-** = no access. Actions: C create, R read, U update, D delete/deactivate.

## 1. Resource matrix

| Resource | SUPER_ADMIN | PATIENT | CLINIC_ADMIN | DOCTOR | PHARMACIST | RIDER | RECEPTIONIST |
|---|---|---|---|---|---|---|---|
| Users (any role) | A CRUD | O RU | - | O RU | O RU | O RU | O RU |
| Addresses | A R | O CRUD | - | - | - | R read (delivery only) | - |
| Clinics | A CRUD | R public | C RU | C R | - | - | C R |
| Clinic staff | A CRUD | - | C CRUD | - | - | - | - |
| Doctors | A CRUD | R public | C CRU (link/unlink) | O RU | - | - | C R |
| Specializations | A CRUD | R public | R | R | - | - | R |
| Schedules | A CRUD | R public | C CRUD | O CRUD (own, own clinics) | - | - | C R |
| Appointments | A R | O CR, cancel | C R, U | R (own patients) U status | - | - | C CRU |
| Live queue | A R | O R | C R | O U (call next) | - | - | C RU |
| Pharmacies | A CRUD | R public | C R (clinic's own) | - | P RU | R (pickup point) | - |
| Pharmacists | A CRUD | - | C R | - | O RU | - | - |
| Products / categories | A CRUD | R public | R | R | R (propose) | - | - |
| Inventory | A R | - | C R | - | P CRUD | - | - |
| Prescriptions | A R | O CR | C R, review | R (assigned) | P R, verify | R none (never) | C R |
| Cart | - | O CRUD | - | - | - | - | - |
| Orders | A R, assign, cancel | O CR, cancel | - | - | P R, accept/reject/prepare | R assigned (delivery view) | - |
| Riders | A CRUD | - | - | - | - | O RU | - |
| Delivery / QR | A assign, generate | O track | - | - | P show QR | R scan, status | - |
| Delivery OTP | none (cannot read value) | O read value | - | - | - | R submit only | - |
| Referrals / coins | A R, adjust | O R | - | - | - | - | - |
| Coupons | A CRUD | R validate/apply | - | - | - | - | - |
| Wallet / ledger | A R all | O R | C R (clinic wallet) | - | - | O R | - |
| Withdrawals | A R, approve/reject, pay | O (customer wallet) CR | C CR (clinic wallet) | - | - | O CR | - |
| Cash collection | A R, verify | - | - | - | - | O CR | - |
| Notifications | A CR (broadcast) | O R | O R | O R | O R | O R | O R |
| Support tickets | A R, assign, resolve | O CR | O CR | O CR | O CR | O CR | O CR |
| Reports | A R all | - | C R (clinic) | O R (own stats) | P R (pharmacy) | O R (own stats) | - |
| Audit logs | A R | - | - | - | - | - | - |
| Platform settings | A CRUD | - | - | - | - | - | - |

## 2. Resource-level rules (enforced in services, not just routes)
1. **Clinic scope:** CLINIC_ADMIN, RECEPTIONIST and DOCTOR actions require an active `clinic_staff` or `doctor_clinics` link to the target clinic.
2. **Pharmacy scope:** PHARMACIST actions require an active `pharmacy_staff` link to the order's/inventory's pharmacy.
3. **Order ownership:** PATIENT sees only orders where `patientId = self`.
4. **Rider scope:** a RIDER can read and act only on `deliveries.riderId = self`, and only in valid delivery states.
5. **OTP:** value readable only by `delivery_otps.customerId = self` via the dedicated endpoint; riders can only submit.
6. **Prescription files:** access only by owner, the assigned clinic staff/pharmacist, or Super Admin, always through short-lived signed URLs; every view is audit-logged. Riders never.
7. **Doctor schedules/fees:** a doctor edits only their own `doctor_clinics` rows; fee changes can be restricted to CLINIC_ADMIN (decision below).
8. **Soft denial:** unauthorized access to an existing resource returns 404 (not 403) where revealing existence would leak data.

## 3. Permission codes (seeded)
Format `resource:action`, e.g. `order:read`, `order:accept`, `order:assign_rider`, `inventory:update`, `wallet:read`, `withdrawal:approve`, `cash:verify`, `audit:read`. Each role gets a fixed set; the full seed list is generated in the Authentication module and documented in `API_REGISTRY.md`.

## 4. Decision needed
Can a Doctor change their own consultation fee for a clinic, or only the Clinic Admin? (Matrix above assumes Clinic Admin only for fees, Doctor for availability.)
