# API REGISTRY

*Note: Detailed API descriptions and live testing are available via the Swagger UI at `https://oshudwalla-backend-1.onrender.com/docs` (Live) or `http://localhost:8000/docs` (Local).*

| # | Module | Method | URL | Auth | Roles | Request Body (JSON Example) | Status | Auto Test | Approved |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Auth | POST | `/api/v1/auth/register` | No | Public (PATIENT) | `{"fullName": "Test", "phone": "9876543210", "password": "Pass"}` | Implemented | Passed | Yes |
| 2 | Auth | POST | `/api/v1/auth/send-otp` | No | Public (PATIENT) | `{"phone": "9876543210"}` | Implemented | Passed (9/9) | Yes |
| 3 | Auth | POST | `/api/v1/auth/register-otp` | No | Public (PATIENT) | `{"fullName": "Test", "phone": "9876543210", "password": "Pass", "otp": "123456"}` | Implemented | Passed (9/9) | Yes |
| 4 | Auth | POST | `/api/v1/auth/login` | No | Public (Email/Phone + Password) | `{"identifier": "9876543210", "password": "Pass"}` | Implemented | Passed | Yes |
| 5 | Auth | POST | `/api/v1/auth/login-otp/send` | No | PATIENT only | `{"phone": "9876543210"}` | Implemented | Passed (9/9) | Yes |
| 6 | Auth | POST | `/api/v1/auth/login-otp/verify` | No | PATIENT only | `{"phone": "9876543210", "otp": "123456"}` | Implemented | Passed (9/9) | Yes |
| 7 | Auth | POST | `/api/v1/auth/refresh` | No | Public | `{"refreshToken": "token", "sessionId": "session"}` | Implemented | Passed | Yes |
| 8 | Auth | POST | `/api/v1/auth/logout` | Yes | All | `{"sessionId": "session_uuid_here"}` | Implemented | Passed | Yes |
| 9 | Notification | POST | `/api/v1/notifications/device-token` | Yes | All | `{"fcmToken": "abc", "deviceType": "ANDROID"}` | Implemented | Passed | Yes |
| 10 | Notification | POST | `/api/v1/notifications/device-token/remove` | Yes | All | `{"fcmToken": "abc"}` | Implemented | Passed | Yes |
| 11 | Notification | GET | `/api/v1/notifications/preferences` | Yes | All | *None* | Implemented | Passed | Yes |
| 12 | Notification | PUT | `/api/v1/notifications/preferences` | Yes | All | `{"globalSettings": {"pushEnabled": true}}` | Implemented | Passed | Yes |
| 13 | Notification | POST | `/api/v1/notifications/test-push` | Yes | All | `{"title": "Hello", "body": "Testing"}` | Implemented | Passed | Yes |
| 14 | User | GET | `/api/v1/users/profile` | Yes | All | *None* | Implemented | Passed | Yes |
| 15 | User | PUT | `/api/v1/users/profile` | Yes | All | `{"fullName": "Soumya", "bloodGroup": "O+"}` | Implemented | Passed | Yes |
| 16 | User | POST | `/api/v1/users/addresses` | Yes | All | `{"fullName": "Soumya", "phone": "6296398479", "line1": "Durgapur", "city": "Durgapur", "state": "WB", "pincode": "713212"}` | Implemented | Passed | Yes |
| 17 | User | GET | `/api/v1/users/addresses` | Yes | All | *None* | Implemented | Passed | Yes |
| 18 | User | PUT | `/api/v1/users/addresses/:id` | Yes | All | `{"isDefault": true}` | Implemented | Passed | Yes |
| 19 | User | DELETE | `/api/v1/users/addresses/:id` | Yes | All | *None* | Implemented | Passed | Yes |
| 20 | Admin | GET | `/api/v1/admin/users` | Yes | SUPER_ADMIN | *None* | Implemented | Passed | Yes |
| 21 | Admin | PUT | `/api/v1/admin/users/:id/access` | Yes | SUPER_ADMIN | `{"roleName": "RIDER", "status": "ACTIVE"}` | Implemented | Passed | Yes |
| 22 | Admin | GET | `/api/v1/admin/settings` | Yes | SUPER_ADMIN | *None* | Implemented | Passed | Yes |
| 23 | Admin | POST | `/api/v1/admin/settings` | Yes | SUPER_ADMIN | `{"key": "REFERRAL_BONUS", "value": {"coins": 50}}` | Implemented | Passed | Yes |
| 24 | Location | GET | `/api/v1/locations` | No | Public | query: `city, state, q, page, limit` (active only) | Implemented | Passed | Yes |
| 25 | Location | GET | `/api/v1/locations/:id` | No | Public | *None* (active only) | Implemented | Passed | Yes |
| 26 | Location | GET | `/api/v1/locations/admin/all` | Yes | SUPER_ADMIN | query: `isActive, city, state, q, page, limit` | Implemented | Passed | Yes |
| 27 | Location | POST | `/api/v1/locations` | Yes | SUPER_ADMIN | `{"city":"Durgapur","area":"City Centre","state":"West Bengal","pincode":"713216","latitude":23.5204,"longitude":87.3119}` | Implemented | Passed | Yes |
| 28 | Location | PUT | `/api/v1/locations/:id` | Yes | SUPER_ADMIN | `{"area":"Bidhannagar"}` | Implemented | Passed | Yes |
| 29 | Location | PATCH | `/api/v1/locations/:id/status` | Yes | SUPER_ADMIN | `{"isActive":false}` | Implemented | Passed | Yes |
| 30 | Specialization | GET | `/api/v1/specializations` | Yes | All | *None* | Implemented | Passed | Yes |
| 31 | Specialization | POST | `/api/v1/specializations` | Yes | SUPER_ADMIN | `{"name":"Cardiology","description":"Heart specialist"}` | Implemented | Passed | Yes |
| 32 | Pharmacy | GET | `/api/v1/pharmacies` | Yes | All | *None* | Implemented | Passed | Yes |
| 33 | Pharmacy | GET | `/api/v1/pharmacies/my` | Yes | PHARMACY, RECEPTIONIST | *None* | Implemented | Passed | Yes |
| 34 | Pharmacy | POST | `/api/v1/pharmacies/admin-create` | Yes | SUPER_ADMIN | `{"name":"Shop","nameBn":"optional","nameHi":"optional","ownerName":"Owner","ownerEmail":"owner@x.com","ownerPassword":"min8chars","phone":"9876500001","locationId":"uuid","line1":"Main Road","latitude":23.5,"longitude":87.3}` | Implemented | Passed (19/19) | Yes |
| 35 | Pharmacy | PUT | `/api/v1/pharmacies/admin-primary/:id` | Yes | SUPER_ADMIN | *None* | Implemented | Passed | Yes |
| 36 | Pharmacy | PUT | `/api/v1/pharmacies/admin-update/:id` | Yes | SUPER_ADMIN | `{"locationId": "uuid", "status": "ACTIVE" \| "SUSPENDED"}` | Implemented | Passed (15/15) | Yes |
| 37 | Pharmacy | PUT | `/api/v1/pharmacies/:id` | Yes | SUPER_ADMIN, PHARMACY (own) | `{"name":"New Name","nameBn":"opt","nameHi":"opt","phone":"9876500001","line1":"Road","line2":null,"latitude":23.5,"longitude":87.3}` | Implemented | Passed (14/14) | Yes |
| 38 | Pharmacy | PUT | `/api/v1/pharmacies/:id/media` | Yes | SUPER_ADMIN, PHARMACY (own) | `{"logoUrl":"https://...","coverUrl":"https://...","galleryUrls":["https://..."]}` | Implemented | Passed (12/12) | Yes |
| 39 | Pharmacy | PUT | `/api/v1/pharmacies/:id/services` | Yes | SUPER_ADMIN | `{"hasClinicService":true,"hasMedicineService":true}` | Implemented | Passed (11/11) | Yes |
| 40 | Pharmacy | GET | `/api/v1/pharmacies/:id/hours` | Yes | All | *None* | Implemented | Passed (12/12) | Yes |
| 41 | Pharmacy | PUT | `/api/v1/pharmacies/:id/hours` | Yes | SUPER_ADMIN, PHARMACY (own) | `{"hours":[{"dayOfWeek":1,"isClosed":false,"openMinute":540,"closeMinute":1260}]}` | Implemented | Passed (12/12) | Yes |
| 42 | Pharmacy | POST | `/api/v1/pharmacies/:id/holidays` | Yes | SUPER_ADMIN, PHARMACY (own) | `{"holidayDate":"2026-12-25","reason":"Christmas"}` | Implemented | Passed (12/12) | Yes |
| 43 | Pharmacy | DELETE | `/api/v1/pharmacies/:id/holidays/:holidayId` | Yes | SUPER_ADMIN, PHARMACY (own) | *None* | Implemented | Passed (12/12) | Yes |
| 44 | Pharmacy | POST | `/api/v1/pharmacies/:id/receptionists` | Yes | SUPER_ADMIN, PHARMACY (own) | `{"fullName":"Recep","phone":"9876500002","email":"r@x.com","password":"min8chars"}` | Implemented | Passed (10/10) | Yes |
| 45 | Pharmacy | GET | `/api/v1/pharmacies/:id/receptionists` | Yes | SUPER_ADMIN, PHARMACY (own) | *None* | Implemented | Passed (10/10) | Yes |
| 46 | Pharmacy | PATCH | `/api/v1/pharmacies/:id/receptionists/:staffId/status` | Yes | SUPER_ADMIN, PHARMACY (own) | `{"isActive":false}` | Implemented | Passed (10/10) | Yes |
| 47 | Doctor | GET | `/api/v1/doctors` | Yes | All | query: `q, specializationId` | Implemented | Passed (11/11) | Yes |
| 48 | Doctor | POST | `/api/v1/doctors` | Yes | SUPER_ADMIN | `{"fullName":"Dr X","phone":"9876543211","registrationNumber":"WB123","specializationIds":["uuid"]}` | Implemented | Passed (11/11) | Yes |
| 49 | Doctor | GET | `/api/v1/doctors/:id` | Yes | All | *None* | Implemented | Passed (11/11) | Yes |
| 50 | Doctor | PUT | `/api/v1/doctors/:id` | Yes | SUPER_ADMIN | `{"experienceYears":10,"isVerified":true}` | Implemented | Passed (11/11) | Yes |
| 51 | Doctor | GET | `/api/v1/doctors/pharmacy/:pharmacyId` | Yes | All | *None* | Implemented | Passed | Yes |
| 52 | Doctor | POST | `/api/v1/doctors/onboard` | Yes | SUPER_ADMIN | `{"pharmacyId":"uuid","fullName":"Dr X","phone":"9876543211","specializationId":"uuid","registrationNumber":"WB123"}` | Implemented | Passed | Yes |
| 53 | Doctor | POST | `/api/v1/doctors/assign` | Yes | SUPER_ADMIN, PHARMACY (own) | `{"pharmacyId":"uuid","doctorId":"uuid","consultationFeePaise":50000}` | Implemented | Passed (11/11) | Yes |
| 54 | Doctor | PATCH | `/api/v1/doctors/assign/:assignmentId/status` | Yes | SUPER_ADMIN, PHARMACY (own) | `{"isActive":false}` | Implemented | Passed (11/11) | Yes |
| 55 | Schedule | POST | `/api/v1/schedules` | Yes | SUPER_ADMIN, PHARMACY (own), DOCTOR (own) | `{"pharmacyDoctorId":"uuid","recurrenceType":"DAILY\|WEEKLY\|MONTHLY_WEEK_DAY\|SPECIFIC_DATE","dayOfWeek":1,"weekOfMonth":2,"specificDate":"2026-12-01","startMinute":600,"endMinute":690,"slotDurationMinutes":30,"slotCapacity":2,"validFrom":"2026-12-01"}` | Implemented | Passed (9/9) | Yes |
| 56 | Schedule | GET | `/api/v1/schedules/pharmacy-doctor/:pharmacyDoctorId` | Yes | All | *None* | Implemented | Passed (9/9) | Yes |
| 57 | Schedule | POST | `/api/v1/schedules/exceptions` | Yes | SUPER_ADMIN, PHARMACY (own), DOCTOR (own) | `{"pharmacyDoctorId":"uuid","exceptionDate":"2026-12-08","type":"LEAVE","reason":"Conference"}` | Implemented | Passed (9/9) | Yes |
| 58 | Schedule | POST | `/api/v1/schedules/generate-slots` | Yes | SUPER_ADMIN, PHARMACY (own), DOCTOR (own) | `{"pharmacyDoctorId":"uuid","fromDate":"2026-12-07","toDate":"2026-12-08"}` | Implemented | Passed (9/9) | Yes |
| 59 | Schedule | GET | `/api/v1/schedules/slots/:pharmacyDoctorId` | Yes | All | query: `date` or `fromDate, toDate` | Implemented | Passed (9/9) | Yes |
| 60 | Schedule | PATCH | `/api/v1/schedules/slots/:slotId/status` | Yes | SUPER_ADMIN, PHARMACY (own), DOCTOR (own) | `{"status":"BLOCKED"}` | Implemented | Passed (9/9) | Yes |
| 61 | Appointment | POST | `/api/v1/appointments` | Yes | PATIENT | `{"slotId":"uuid","reason":"Fever","idempotencyKey":"key-1"}` | Implemented | Passed (8/8) | Yes |
| 62 | Appointment | GET | `/api/v1/appointments/my` | Yes | PATIENT | *None* | Implemented | Passed (8/8) | Yes |
| 63 | Appointment | GET | `/api/v1/appointments/pharmacy-doctor/:pharmacyDoctorId` | Yes | SUPER_ADMIN, PHARMACY, RECEPTIONIST, DOCTOR | query: `date` | Implemented | Passed (8/8) | Yes |
| 64 | Appointment | PATCH | `/api/v1/appointments/:id/cancel` | Yes | PATIENT (own), SUPER_ADMIN, PHARMACY, RECEPTIONIST | `{"cancelReason":"..."}` | Implemented | Passed (8/8) | Yes |
| 65 | Appointment | PATCH | `/api/v1/appointments/:id/status` | Yes | SUPER_ADMIN, PHARMACY, RECEPTIONIST, DOCTOR | `{"status":"CHECKED_IN" \| "IN_CONSULTATION" \| "COMPLETED" \| "NO_SHOW","doctorNotes":"..."}` | Implemented | Passed (8/8) | Yes |
| 66 | Appointment | GET | `/api/v1/appointments/queue/:pharmacyDoctorId` | Yes | All | query: `date` | Implemented | Passed (8/8) | Yes |
| 67 | Appointment | PATCH | `/api/v1/appointments/queue/:pharmacyDoctorId/status` | Yes | SUPER_ADMIN, PHARMACY, RECEPTIONIST, DOCTOR | `{"queueDate":"2026-12-14","status":"OPEN" \| "PAUSED" \| "CLOSED"}` | Implemented | Passed (8/8) | Yes |
| 68 | Category | GET | `/api/v1/categories` | No | Public | query: `parentId` | Implemented | Passed (8/8) | Yes |
| 69 | Category | POST | `/api/v1/categories` | Yes | SUPER_ADMIN | `{"name":"Pain Relief","slug":"pain-relief","sortOrder":1}` | Implemented | Passed (8/8) | Yes |
| 70 | Category | PUT | `/api/v1/categories/:id` | Yes | SUPER_ADMIN | `{"name":"Updated","isActive":true}` | Implemented | Passed (8/8) | Yes |
| 71 | Product | GET | `/api/v1/products` | No | Public | query: `q, categoryId, requiresPrescription, page, limit` | Implemented | Passed (8/8) | Yes |
| 72 | Product | GET | `/api/v1/products/:id` | No | Public | *None* | Implemented | Passed (8/8) | Yes |
| 73 | Product | POST | `/api/v1/products` | Yes | SUPER_ADMIN | `{"name":"Paracetamol 500mg","categoryId":"uuid","mrpPaise":3000,"requiresPrescription":false}` | Implemented | Passed (8/8) | Yes |
| 74 | Product | PUT | `/api/v1/products/:id` | Yes | SUPER_ADMIN | `{"mrpPaise":3200}` | Implemented | Passed (8/8) | Yes |
| 75 | Cart | GET | `/api/v1/cart` | Yes | PATIENT | *None* | Implemented | Passed (8/8) | Yes |
| 76 | Cart | POST | `/api/v1/cart/items` | Yes | PATIENT | `{"productId":"uuid","quantity":2}` | Implemented | Passed (8/8) | Yes |
| 77 | Cart | PUT | `/api/v1/cart/items/:productId` | Yes | PATIENT | `{"quantity":3}` | Implemented | Passed (8/8) | Yes |
| 78 | Cart | DELETE | `/api/v1/cart/items/:productId` | Yes | PATIENT | *None* | Implemented | Passed (8/8) | Yes |
| 79 | Cart | DELETE | `/api/v1/cart` | Yes | PATIENT | *None* | Implemented | Passed (8/8) | Yes |
| 80 | Prescription | POST | `/api/v1/prescriptions` | Yes | PATIENT | `{"pharmacyId":"uuid (opt)","doctorName":"Dr X","files":[{"storageKey":"cloudinary_public_id","mimeType":"image/jpeg","sizeBytes":12000,"checksumSha256":"..."}]}` | Implemented | Passed (8/8) | Yes |
| 81 | Prescription | GET | `/api/v1/prescriptions/my` | Yes | PATIENT | *None* | Implemented | Passed (8/8) | Yes |
| 82 | Prescription | GET | `/api/v1/prescriptions/pharmacy/:pharmacyId` | Yes | SUPER_ADMIN, PHARMACY (own) | *None* | Implemented | Passed (8/8) | Yes |
| 83 | Prescription | PATCH | `/api/v1/prescriptions/:id/review` | Yes | SUPER_ADMIN, PHARMACY (own) | `{"status":"VERIFIED" \| "REJECTED","rejectionReason":"..."}` | Implemented | Passed (8/8) | Yes |
| 84 | Order | POST | `/api/v1/orders` | Yes | PATIENT | `{"addressId":"uuid","pharmacyId":"uuid (opt)","prescriptionId":"uuid (opt)","couponCode":"OSHUD20 (opt)","idempotencyKey":"key-1"}` | Implemented | Passed (8/8) | Yes |
| 85 | Order | GET | `/api/v1/orders/my` | Yes | PATIENT | *None* | Implemented | Passed (8/8) | Yes |
| 86 | Order | GET | `/api/v1/orders/pharmacy/:pharmacyId` | Yes | SUPER_ADMIN, PHARMACY (own) | *None* | Implemented | Passed (8/8) | Yes |
| 87 | Order | PATCH | `/api/v1/orders/:id/status` | Yes | SUPER_ADMIN, PHARMACY (own) | `{"status":"ACCEPTED" \| "PREPARING" \| "READY_FOR_PICKUP" \| "REJECTED"}` | Implemented | Passed (8/8) | Yes |
| 88 | Order | PATCH | `/api/v1/orders/:id/cancel` | Yes | PATIENT (own), SUPER_ADMIN | `{"cancelReason":"..."}` | Implemented | Passed (8/8) | Yes |
| 89 | Order | GET | `/api/v1/orders/:id/invoice.pdf` | Yes | PATIENT (own), SUPER_ADMIN, PHARMACY | *None* (returns PDF stream) | Implemented | Verified | Yes |
| 90 | Rider | POST | `/api/v1/riders/admin-create` | Yes | SUPER_ADMIN | `{"fullName":"Rider","phone":"9876543210","email":"r@x.com","password":"min8chars","vehicleType":"Bike","vehicleNumber":"WB39A1234"}` | Implemented | Passed (7/7) | Yes |
| 91 | Rider | GET | `/api/v1/riders` | Yes | SUPER_ADMIN | *None* | Implemented | Passed (7/7) | Yes |
| 92 | Rider | PATCH | `/api/v1/riders/:userId/status` | Yes | SUPER_ADMIN | `{"status":"AVAILABLE","kycStatus":"APPROVED"}` | Implemented | Passed (7/7) | Yes |
| 93 | Delivery | POST | `/api/v1/deliveries/assign` | Yes | SUPER_ADMIN | `{"riderId":"uuid","orderIds":["uuid"]}` | Implemented | Passed (7/7) | Yes |
| 94 | Delivery | GET | `/api/v1/deliveries/my` | Yes | RIDER | *None* | Implemented | Passed (7/7) | Yes |
| 95 | Delivery | POST | `/api/v1/deliveries/pickup-qr/scan` | Yes | RIDER | `{"qrToken":"QR-..."}` | Implemented | Passed (7/7) | Yes |
| 96 | Delivery | POST | `/api/v1/deliveries/:deliveryId/arrived` | Yes | RIDER | *None* | Implemented | Passed (7/7) | Yes |
| 97 | Delivery | GET | `/api/v1/deliveries/order/:orderId/otp` | Yes | PATIENT (own) | *None* | Implemented | Passed (7/7) | Yes |
| 98 | Delivery | POST | `/api/v1/deliveries/:deliveryId/complete` | Yes | RIDER | `{"otp":"123456"}` | Implemented | Passed (7/7) | Yes |
| 99 | Wallet | GET | `/api/v1/wallet/my` | Yes | RIDER, PATIENT, PHARMACY | *None* | Implemented | Passed (6/6) | Yes |
| 100 | Wallet | POST | `/api/v1/wallet/withdrawals` | Yes | RIDER, PATIENT, PHARMACY | `{"amountPaise":4000,"payoutDetails":{"method":"UPI","upiId":"rider@upi"},"idempotencyKey":"wd-1"}` | Implemented | Passed (6/6) | Yes |
| 101 | Wallet | GET | `/api/v1/wallet/withdrawals` | Yes | SUPER_ADMIN, RIDER, PATIENT, PHARMACY | *None* | Implemented | Passed (6/6) | Yes |
| 102 | Wallet | PATCH | `/api/v1/wallet/withdrawals/:id/review` | Yes | SUPER_ADMIN | `{"decision":"PAID" \| "REJECTED","method":"UPI","referenceNo":"UTR123","rejectionReason":"..."}` | Implemented | Passed (6/6) | Yes |
| 103 | Cash | GET | `/api/v1/cash/my` | Yes | RIDER | *None* | Implemented | Passed (6/6) | Yes |
| 104 | Cash | POST | `/api/v1/cash/deposits` | Yes | RIDER | `{"collectionIds":["uuid"],"method":"UPI","referenceNo":"COD-UTR-999"}` | Implemented | Passed (6/6) | Yes |
| 105 | Cash | PATCH | `/api/v1/cash/deposits/:id/verify` | Yes | SUPER_ADMIN | `{"decision":"VERIFIED" \| "REJECTED","rejectionReason":"..."}` | Implemented | Passed (6/6) | Yes |
| 106 | Coupon | GET | `/api/v1/coupons` | Yes | All (active only for non-admin) | *None* | Implemented | Passed (6/6) | Yes |
| 107 | Coupon | POST | `/api/v1/coupons` | Yes | SUPER_ADMIN | `{"code":"OSHUD20","discountType":"PERCENT","discountValue":20,"maxDiscountPaise":5000,"minOrderPaise":10000,"validFrom":"2026-11-22T00:00:00Z","validTo":"2026-12-31T23:59:59Z","usageLimitPerUser":1}` | Implemented | Passed (6/6) | Yes |
| 108 | Coupon | PUT | `/api/v1/coupons/:id` | Yes | SUPER_ADMIN | `{"usageLimitPerUser":2,"isActive":true}` | Implemented | Verified | Yes |
| 109 | Coupon | POST | `/api/v1/coupons/validate` | Yes | PATIENT | `{"code":"OSHUD20","subtotalPaise":50000}` | Implemented | Passed (6/6) | Yes |
| 110 | Coupon | PATCH | `/api/v1/coupons/:id/status` | Yes | SUPER_ADMIN | `{"isActive":false}` | Implemented | Passed (6/6) | Yes |
| 111 | Referral | GET | `/api/v1/referrals/my` | Yes | PATIENT | *None* | Implemented | Passed (6/6) | Yes |
| 112 | Referral | POST | `/api/v1/referrals/apply` | Yes | PATIENT | `{"referrerId":"uuid"}` | Implemented | Passed (6/6) | Yes |
| 113 | Referral | POST | `/api/v1/referrals/:id/reward` | Yes | SUPER_ADMIN | `{"rewardCoins":50}` | Implemented | Passed (6/6) | Yes |
| 114 | Support | POST | `/api/v1/support/tickets` | Yes | All | `{"subject":"Late delivery","message":"Where is my order?","priority":"HIGH"}` | Implemented | Passed (6/6) | Yes |
| 115 | Support | GET | `/api/v1/support/tickets` | Yes | All (own; all for SUPER_ADMIN) | *None* | Implemented | Passed (6/6) | Yes |
| 116 | Support | GET | `/api/v1/support/tickets/:id` | Yes | Owner, SUPER_ADMIN | *None* | Implemented | Passed (6/6) | Yes |
| 117 | Support | POST | `/api/v1/support/tickets/:id/messages` | Yes | Owner, SUPER_ADMIN | `{"body":"We are checking now."}` | Implemented | Passed (6/6) | Yes |
| 118 | Support | PATCH | `/api/v1/support/tickets/:id/status` | Yes | SUPER_ADMIN | `{"status":"RESOLVED","priority":"HIGH"}` | Implemented | Passed (6/6) | Yes |
| 119 | Promotion | GET | `/api/v1/promotions` | No | Public | query: `placement` (e.g. `HOME_TOP`) | Implemented | Verified | Yes |
| 120 | Promotion | GET | `/api/v1/promotions/admin` | Yes | SUPER_ADMIN | *None* | Implemented | Verified | Yes |
| 121 | Promotion | POST | `/api/v1/promotions` | Yes | SUPER_ADMIN | `{"heading":"Flat 20% Off","paragraph":"Use OSHUD20 on orders above ₹100","imageUrl":"https://...","buttonText":"Apply Coupon","buttonLink":"/medicines","couponCode":"OSHUD20","placement":"HOME_TOP","sortOrder":0}` | Implemented | Verified | Yes |
| 122 | Promotion | PUT | `/api/v1/promotions/:id` | Yes | SUPER_ADMIN | `{"sortOrder":1,"isActive":false}` | Implemented | Verified | Yes |
| 123 | Promotion | DELETE | `/api/v1/promotions/:id` | Yes | SUPER_ADMIN | *None* | Implemented | Verified | Yes |
| 124 | Upload | POST | `/api/v1/uploads` | Yes | All | `multipart/form-data`: `file` (JPG/PNG/WEBP/PDF, max 5MB), `folder` (opt: `prescriptions\|promotions\|pharmacies\|products\|profiles\|doctors`) | Implemented | Verified | Yes |
| 125 | Upload | POST | `/api/v1/uploads/multiple` | Yes | All | `multipart/form-data`: `files` (up to 5 files), `folder` (opt) | Implemented | Verified | Yes |
