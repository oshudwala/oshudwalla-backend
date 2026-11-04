# Role Permission Matrix (design v2: unified Establishment)

Roles (seven): SUPER_ADMIN, PATIENT, ESTABLISHMENT_ADMIN, DOCTOR, PHARMACIST, RIDER, RECEPTIONIST.

Legend: **A** all records, **O** own records, **E** own establishment(s) only, **E-C** own establishment, CLINIC service must be ACTIVE, **E-P** own establishment, PHARMACY service must be ACTIVE, **R** assigned rider records only, **-** no access. Actions: C create, R read, U update, D delete/deactivate.

## 1. Resource matrix

| Resource | SUPER_ADMIN | PATIENT | ESTABLISHMENT_ADMIN | DOCTOR | PHARMACIST | RIDER | RECEPTIONIST |
|---|---|---|---|---|---|---|---|
| Users (any role) | A CRUD | O RU | - | O RU | O RU | O RU | O RU |
| Addresses | A R | O CRUD | - | - | - | R (delivery only) | - |
| Establishment profile | A CRUD, approve, suspend | R public | E RU | E R | E R | R (pickup point) | E R |
| Establishment services (enable, settings, pause) | A approve, suspend, disable | R public | E CRU (request, settings, pause) | - | - | - | - |
| Establishment staff | A CRUD | - | E CRUD | - | - | - | - |
| Doctors (link, fee) | A CRUD | R public | E-C CRU (link/unlink, fee) | O RU profile | - | - | E-C R |
| Specializations | A CRUD | R public | R | R | - | - | R |
| Schedules, exceptions | A CRUD | R public | E-C CRUD | O CRUD (own links) | - | - | E-C R |
| Appointments | A R | O CR, cancel | E-C R, U | R (own patients), U status | - | - | E-C CRU |
| Live queue | A R | O R | E-C R | O U (call next) | - | - | E-C RU |
| Pharmacists (staff) | A CRUD | - | E-P CRUD | - | O RU | - | - |
| Products / categories | A CRUD | R public | R | R | R (propose) | - | - |
| Inventory | A R | - | E-P R | - | E-P CRUD | - | - |
| Prescriptions | A R, route | O CR | E-C review (when required), E-P R | R (assigned, clinic review) | E-P R, verify | none (never) | E-C R |
| Cart | - | O CRUD | - | - | - | - | - |
| Orders | A R, assign, cancel | O CR, cancel | E-P R | - | E-P R, accept/reject/prepare | R assigned (delivery view) | - |
| Riders | A CRUD | - | - | - | - | O RU | - |
| Delivery / QR | A assign, generate | O track | - | - | E-P show QR | R scan, status | - |
| Delivery OTP | none (cannot read value) | O read value | - | - | - | R submit only | - |
| Referrals / coins | A R, adjust | O R | - | - | - | - | - |
| Coupons | A CRUD | R validate/apply | - | - | - | - | - |
| Wallet / ledger | A R all | O R | E R (establishment wallet) | - | - | O R | - |
| Withdrawals | A R, approve/reject/pay | O CR (customer wallet) | E CR (establishment wallet) | - | - | O CR | - |
| Cash collection | A R, verify | - | - | - | - | O CR | - |
| Notifications (own inbox, devices, preferences) | O | O | O | O | O | O | O |
| Notification broadcast, delivery logs, stats | A | - | - | - | - | - | - |
| Support tickets | A R, assign, resolve | O CR | O CR | O CR | O CR | O CR | O CR |
| Reports | A R all | - | E R (per service) | O R (own stats) | E-P R | O R (own stats) | - |
| Audit logs | A R | - | - | - | - | - | - |
| Platform settings (incl. Primary Pharmacy) | A CRUD | - | - | - | - | - | - |

## 2. Resource-level rules (enforced in services, not just routes)
1. **Establishment scope**: every ESTABLISHMENT_ADMIN, RECEPTIONIST, PHARMACIST action requires an active `establishment_staff` row for that establishment; DOCTOR actions require an active `doctor_establishments` row.
2. **Service scope**: the staff role must fit the service (RECEPTIONIST only CLINIC, PHARMACIST only PHARMACY, ADMIN both), and that service must be `ACTIVE` on the establishment. Otherwise `SERVICE_NOT_ENABLED` (409) or 404.
3. **Order ownership**: PATIENT sees only orders with `patientId = self`.
4. **Rider scope**: a RIDER reads and acts only on `deliveries.riderId = self`, in valid delivery states.
5. **OTP**: value readable only by `delivery_otps.customerId = self`; riders can only submit.
6. **Prescription files**: owner, the assigned reviewing staff of the source or pharmacy establishment, or Super Admin; signed URLs only; every view audit-logged; riders never.
7. **Doctor fees**: only ESTABLISHMENT_ADMIN (or Super Admin) changes `consultationFeePaise`; doctors manage availability (draft assumption, open question 5).
8. **Notifications**: a user reads, marks and configures only their own notifications, preferences and devices; other users' ids return 404.
9. **Soft denial**: unauthorized access to an existing resource returns 404 where revealing existence would leak data.

## 3. Permission codes (seeded in the Authentication module)
`resource:action`, with service prefix where a service applies: `clinic.appointment:read`, `clinic.queue:update`, `pharmacy.order:accept`, `pharmacy.inventory:update`, `establishment:update`, `establishment.service:request`, `order:assign_rider`, `wallet:read`, `withdrawal:approve`, `cash:verify`, `notification:broadcast`, `audit:read`. Each role gets a fixed set; the full list is documented in `API_REGISTRY.md` at seed time.

## 4. Decisions needed
- Confirm role rename `CLINIC_ADMIN` to `ESTABLISHMENT_ADMIN` (see `DESIGN_CHANGES_V2.md`).
- Can a doctor change their own fee, or only the Establishment Admin? (Matrix assumes Admin only.)
