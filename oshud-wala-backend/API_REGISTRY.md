# API REGISTRY

| Module | Method | URL | Auth | Roles | Request Body (JSON Example) | Status | Auto Test | Approved |
|---|---|---|---|---|---|---|---|---|
| Auth | POST | `/api/v1/auth/register` | No | Public (PATIENT) | `{"fullName": "Test", "phone": "9876543210", "password": "Pass"}` | Implemented | Passed | Yes |
| Auth | POST | `/api/v1/auth/send-otp` | No | Public (PATIENT) | `{"phone": "9876543210"}` | Implemented | Passed (9/9) | Yes |
| Auth | POST | `/api/v1/auth/register-otp` | No | Public (PATIENT) | `{"fullName": "Test", "phone": "9876543210", "password": "Pass", "otp": "123456"}` | Implemented | Passed (9/9) | Yes |
| Auth | POST | `/api/v1/auth/login` | No | Public (Email/Phone + Password) | `{"identifier": "9876543210", "password": "Pass"}` | Implemented | Passed | Yes |
| Auth | POST | `/api/v1/auth/login-otp/send` | No | PATIENT only | `{"phone": "9876543210"}` | Implemented | Passed (9/9) | Yes |
| Auth | POST | `/api/v1/auth/login-otp/verify` | No | PATIENT only | `{"phone": "9876543210", "otp": "123456"}` | Implemented | Passed (9/9) | Yes |
| Auth | POST | `/api/v1/auth/refresh` | No | Public | `{"refreshToken": "token", "sessionId": "session"}` | Implemented | Passed | Yes |
| Auth | POST | `/api/v1/auth/logout` | Yes | All | `{"sessionId": "session_uuid_here"}` | Implemented | Passed | Yes |
| Notification | POST | `/api/v1/notifications/device-token` | Yes | All | `{"fcmToken": "abc", "deviceType": "ANDROID"}` | Implemented | Passed | Yes |
| Notification | POST | `/api/v1/notifications/device-token/remove` | Yes | All | `{"fcmToken": "abc"}` | Implemented | Passed | Yes |
| Notification | GET | `/api/v1/notifications/preferences` | Yes | All | *None* | Implemented | Passed | Yes |
| Notification | PUT | `/api/v1/notifications/preferences` | Yes | All | `{"globalSettings": {"pushEnabled": true}}` | Implemented | Passed | Yes |
| Notification | POST | `/api/v1/notifications/test-push` | Yes | All | `{"title": "Hello", "body": "Testing"}` | Implemented | Passed | Yes |
| User | GET | `/api/v1/users/profile` | Yes | All | *None* | Implemented | Passed | Yes |
| User | PUT | `/api/v1/users/profile` | Yes | All | `{"fullName": "Soumya", "bloodGroup": "O+"}` | Implemented | Passed | Yes |
| User | POST | `/api/v1/users/addresses` | Yes | All | `{"fullName": "Soumya", "phone": "6296398479", "line1": "Durgapur", "city": "Durgapur", "state": "WB", "pincode": "713212"}` | Implemented | Passed | Yes |
| User | GET | `/api/v1/users/addresses` | Yes | All | *None* | Implemented | Passed | Yes |
| User | PUT | `/api/v1/users/addresses/:id` | Yes | All | `{"isDefault": true}` | Implemented | Passed | Yes |
| User | DELETE | `/api/v1/users/addresses/:id` | Yes | All | *None* | Implemented | Passed | Yes |
| Admin | GET | `/api/v1/admin/users` | Yes | SUPER_ADMIN | *None* | Implemented | Passed | Yes |
| Admin | PUT | `/api/v1/admin/users/:id/access` | Yes | SUPER_ADMIN | `{"roleName": "RIDER", "status": "ACTIVE"}` | Implemented | Passed | Yes |
| Admin | GET | `/api/v1/admin/settings` | Yes | SUPER_ADMIN | *None* | Implemented | Passed | Yes |
| Admin | POST | `/api/v1/admin/settings` | Yes | SUPER_ADMIN | `{"key": "REFERRAL_BONUS", "value": {"coins": 50}}` | Implemented | Passed | Yes |
| Location | GET | `/api/v1/locations` | No | Public | query: `city, state, q, page, limit` (active only) | Implemented | Passed | Yes |
| Location | GET | `/api/v1/locations/:id` | No | Public | *None* (active only) | Implemented | Passed | Yes |
| Location | GET | `/api/v1/locations/admin/all` | Yes | SUPER_ADMIN | query: `isActive, city, state, q, page, limit` | Implemented | Passed | Yes |
| Location | POST | `/api/v1/locations` | Yes | SUPER_ADMIN | `{"city":"Durgapur","area":"City Centre","state":"West Bengal","pincode":"713216","latitude":23.5204,"longitude":87.3119}` | Implemented | Passed | Yes |
| Location | PUT | `/api/v1/locations/:id` | Yes | SUPER_ADMIN | `{"area":"Bidhannagar"}` | Implemented | Passed | Yes |
| Location | PATCH | `/api/v1/locations/:id/status` | Yes | SUPER_ADMIN | `{"isActive":false}` | Implemented | Passed | Yes |
| Specialization | GET | `/api/v1/specializations` | Yes | All | *None* | Implemented | Passed | Yes |
| Specialization | POST | `/api/v1/specializations` | Yes | SUPER_ADMIN | `{"name":"Cardiology","description":"Heart specialist"}` | Implemented | Passed | Yes |
| Pharmacy | GET | `/api/v1/pharmacies` | Yes | All | *None* | Implemented | Passed | Yes |
| Pharmacy | GET | `/api/v1/pharmacies/my` | Yes | PHARMACY | *None* | Implemented | Passed | Yes |
| Pharmacy | POST | `/api/v1/pharmacies/admin-create` | Yes | SUPER_ADMIN | `{"name":"Shop","nameBn":"optional","nameHi":"optional","ownerName":"Owner","ownerEmail":"owner@x.com","ownerPassword":"min8chars","phone":"9876500001","locationId":"uuid","line1":"Main Road","latitude":23.5,"longitude":87.3}` | Implemented | Passed (19/19) | Yes |
| Pharmacy | PUT | `/api/v1/pharmacies/admin-primary/:id` | Yes | SUPER_ADMIN | *None* | Implemented | Passed | Yes |
| Pharmacy | PUT | `/api/v1/pharmacies/admin-update/:id` | Yes | SUPER_ADMIN | `{"locationId": "uuid", "status": "ACTIVE" \| "SUSPENDED"}` | Implemented | Passed (15/15) | Yes |
| Pharmacy | PUT | `/api/v1/pharmacies/:id` | Yes | SUPER_ADMIN, PHARMACY (own) | `{"name":"New Name","nameBn":"opt","nameHi":"opt","phone":"9876500001","line1":"Road","line2":null,"latitude":23.5,"longitude":87.3}` | Implemented | Passed (14/14) | Yes |
| Pharmacy | PUT | `/api/v1/pharmacies/:id/media` | Yes | SUPER_ADMIN, PHARMACY (own) | `{"logoUrl":"https://...","coverUrl":"https://...","galleryUrls":["https://..."]}` | Implemented | Passed (12/12) | Yes |
| Pharmacy | PUT | `/api/v1/pharmacies/:id/services` | Yes | SUPER_ADMIN | `{"hasClinicService":true,"hasMedicineService":true}` | Implemented | Passed (11/11) | Yes |
| Pharmacy | GET | `/api/v1/pharmacies/:id/hours` | Yes | All | *None* | Implemented | Passed (12/12) | Yes |
| Pharmacy | PUT | `/api/v1/pharmacies/:id/hours` | Yes | SUPER_ADMIN, PHARMACY (own) | `{"hours":[{"dayOfWeek":1,"isClosed":false,"openMinute":540,"closeMinute":1260}]}` | Implemented | Passed (12/12) | Yes |
| Pharmacy | POST | `/api/v1/pharmacies/:id/holidays` | Yes | SUPER_ADMIN, PHARMACY (own) | `{"holidayDate":"2026-12-25","reason":"Christmas"}` | Implemented | Passed (12/12) | Yes |
| Pharmacy | DELETE | `/api/v1/pharmacies/:id/holidays/:holidayId` | Yes | SUPER_ADMIN, PHARMACY (own) | *None* | Implemented | Passed (12/12) | Yes |
| Pharmacy | POST | `/api/v1/pharmacies/:id/receptionists` | Yes | SUPER_ADMIN, PHARMACY (own) | `{"fullName":"Recep","phone":"9876500002","email":"r@x.com","password":"min8chars"}` | Implemented | Passed (10/10) | Yes |
| Pharmacy | GET | `/api/v1/pharmacies/:id/receptionists` | Yes | SUPER_ADMIN, PHARMACY (own) | *None* | Implemented | Passed (10/10) | Yes |
| Pharmacy | PATCH | `/api/v1/pharmacies/:id/receptionists/:staffId/status` | Yes | SUPER_ADMIN, PHARMACY (own) | `{"isActive":false}` | Implemented | Passed (10/10) | Yes |
| Doctor | GET | `/api/v1/doctors` | Yes | All | query: `q, specializationId` | Implemented | Passed (11/11) | Yes |
| Doctor | POST | `/api/v1/doctors` | Yes | SUPER_ADMIN | `{"fullName":"Dr X","phone":"9876543211","registrationNumber":"WB123","specializationIds":["uuid"]}` | Implemented | Passed (11/11) | Yes |
| Doctor | GET | `/api/v1/doctors/:id` | Yes | All | *None* | Implemented | Passed (11/11) | Yes |
| Doctor | PUT | `/api/v1/doctors/:id` | Yes | SUPER_ADMIN | `{"experienceYears":10,"isVerified":true}` | Implemented | Passed (11/11) | Yes |
| Doctor | GET | `/api/v1/doctors/pharmacy/:pharmacyId` | Yes | All | *None* | Implemented | Passed | Yes |
| Doctor | POST | `/api/v1/doctors/onboard` | Yes | SUPER_ADMIN | `{"pharmacyId":"uuid","fullName":"Dr X","phone":"9876543211","specializationId":"uuid","registrationNumber":"WB123"}` | Implemented | Passed | Yes |
| Doctor | POST | `/api/v1/doctors/assign` | Yes | SUPER_ADMIN, PHARMACY (own) | `{"pharmacyId":"uuid","doctorId":"uuid","consultationFeePaise":50000}` | Implemented | Passed (11/11) | Yes |
| Doctor | PATCH | `/api/v1/doctors/assign/:assignmentId/status` | Yes | SUPER_ADMIN, PHARMACY (own) | `{"isActive":false}` | Implemented | Passed (11/11) | Yes |

*Note: Detailed API descriptions and live testing are available via the Swagger UI at `https://oshudwalla-backend-1.onrender.com/docs` (Live) or `http://localhost:8000/docs` (Local).*
| Schedule | POST | `/api/v1/schedules` | Yes | SUPER_ADMIN, PHARMACY (own), DOCTOR (own) | `{"pharmacyDoctorId":"uuid","dayOfWeek":1,"startMinute":600,"endMinute":690,"slotDurationMinutes":30,"slotCapacity":2,"validFrom":"2026-12-01"}` | Implemented | Passed (9/9) | Yes |
| Schedule | GET | `/api/v1/schedules/pharmacy-doctor/:pharmacyDoctorId` | Yes | All | *None* | Implemented | Passed (9/9) | Yes |
| Schedule | POST | `/api/v1/schedules/exceptions` | Yes | SUPER_ADMIN, PHARMACY (own), DOCTOR (own) | `{"pharmacyDoctorId":"uuid","exceptionDate":"2026-12-08","type":"LEAVE","reason":"Conference"}` | Implemented | Passed (9/9) | Yes |
| Schedule | POST | `/api/v1/schedules/generate-slots` | Yes | SUPER_ADMIN, PHARMACY (own), DOCTOR (own) | `{"pharmacyDoctorId":"uuid","fromDate":"2026-12-07","toDate":"2026-12-08"}` | Implemented | Passed (9/9) | Yes |
| Schedule | GET | `/api/v1/schedules/slots/:pharmacyDoctorId` | Yes | All | query: `date` or `fromDate, toDate` | Implemented | Passed (9/9) | Yes |
| Schedule | PATCH | `/api/v1/schedules/slots/:slotId/status` | Yes | SUPER_ADMIN, PHARMACY (own), DOCTOR (own) | `{"status":"BLOCKED"}` | Implemented | Passed (9/9) | Yes |
| Schedule | POST | `/api/v1/schedules` | Yes | SUPER_ADMIN, PHARMACY (own), DOCTOR (own) | `{"pharmacyDoctorId":"uuid","dayOfWeek":1,"startMinute":600,"endMinute":690,"slotDurationMinutes":30,"slotCapacity":2,"validFrom":"2026-12-01"}` | Implemented | Passed (9/9) | Yes |
| Schedule | GET | `/api/v1/schedules/pharmacy-doctor/:pharmacyDoctorId` | Yes | All | *None* | Implemented | Passed (9/9) | Yes |
| Schedule | POST | `/api/v1/schedules/exceptions` | Yes | SUPER_ADMIN, PHARMACY (own), DOCTOR (own) | `{"pharmacyDoctorId":"uuid","exceptionDate":"2026-12-08","type":"LEAVE","reason":"Conference"}` | Implemented | Passed (9/9) | Yes |
| Schedule | POST | `/api/v1/schedules/generate-slots` | Yes | SUPER_ADMIN, PHARMACY (own), DOCTOR (own) | `{"pharmacyDoctorId":"uuid","fromDate":"2026-12-07","toDate":"2026-12-08"}` | Implemented | Passed (9/9) | Yes |
| Schedule | GET | `/api/v1/schedules/slots/:pharmacyDoctorId` | Yes | All | query: `date` or `fromDate, toDate` | Implemented | Passed (9/9) | Yes |
| Schedule | PATCH | `/api/v1/schedules/slots/:slotId/status` | Yes | SUPER_ADMIN, PHARMACY (own), DOCTOR (own) | `{"status":"BLOCKED"}` | Implemented | Passed (9/9) | Yes |
| Appointment | POST | `/api/v1/appointments` | Yes | PATIENT | `{"slotId":"uuid","reason":"Fever","idempotencyKey":"key-1"}` | Implemented | Passed (8/8) | Yes |
| Appointment | GET | `/api/v1/appointments/my` | Yes | PATIENT | *None* | Implemented | Passed (8/8) | Yes |
| Appointment | GET | `/api/v1/appointments/pharmacy-doctor/:pharmacyDoctorId` | Yes | SUPER_ADMIN, PHARMACY, RECEPTIONIST, DOCTOR | query: `date` | Implemented | Passed (8/8) | Yes |
| Appointment | PATCH | `/api/v1/appointments/:id/cancel` | Yes | PATIENT (own), SUPER_ADMIN, PHARMACY, RECEPTIONIST | `{"cancelReason":"..."}` | Implemented | Passed (8/8) | Yes |
| Appointment | PATCH | `/api/v1/appointments/:id/status` | Yes | SUPER_ADMIN, PHARMACY, RECEPTIONIST, DOCTOR | `{"status":"CHECKED_IN" \| "IN_CONSULTATION" \| "COMPLETED" \| "NO_SHOW","doctorNotes":"..."}` | Implemented | Passed (8/8) | Yes |
| Appointment | GET | `/api/v1/appointments/queue/:pharmacyDoctorId` | Yes | All | query: `date` | Implemented | Passed (8/8) | Yes |
| Appointment | PATCH | `/api/v1/appointments/queue/:pharmacyDoctorId/status` | Yes | SUPER_ADMIN, PHARMACY, RECEPTIONIST, DOCTOR | `{"queueDate":"2026-12-14","status":"OPEN" \| "PAUSED" \| "CLOSED"}` | Implemented | Passed (8/8) | Yes |
| Category | GET | `/api/v1/categories` | No | Public | query: `parentId` | Implemented | Passed (8/8) | Yes |
| Category | POST | `/api/v1/categories` | Yes | SUPER_ADMIN | `{"name":"Pain Relief","slug":"pain-relief","sortOrder":1}` | Implemented | Passed (8/8) | Yes |
| Category | PUT | `/api/v1/categories/:id` | Yes | SUPER_ADMIN | `{"name":"Updated","isActive":true}` | Implemented | Passed (8/8) | Yes |
| Product | GET | `/api/v1/products` | No | Public | query: `q, categoryId, requiresPrescription, page, limit` | Implemented | Passed (8/8) | Yes |
| Product | GET | `/api/v1/products/:id` | No | Public | *None* | Implemented | Passed (8/8) | Yes |
| Product | POST | `/api/v1/products` | Yes | SUPER_ADMIN | `{"name":"Paracetamol 500mg","categoryId":"uuid","mrpPaise":3000,"requiresPrescription":false}` | Implemented | Passed (8/8) | Yes |
| Product | PUT | `/api/v1/products/:id` | Yes | SUPER_ADMIN | `{"mrpPaise":3200}` | Implemented | Passed (8/8) | Yes |
| Cart | GET | `/api/v1/cart` | Yes | PATIENT | *None* | Implemented | Passed (8/8) | Yes |
| Cart | POST | `/api/v1/cart/items` | Yes | PATIENT | `{"productId":"uuid","quantity":2}` | Implemented | Passed (8/8) | Yes |
| Cart | PUT | `/api/v1/cart/items/:productId` | Yes | PATIENT | `{"quantity":3}` | Implemented | Passed (8/8) | Yes |
| Cart | DELETE | `/api/v1/cart/items/:productId` | Yes | PATIENT | *None* | Implemented | Passed (8/8) | Yes |
| Cart | DELETE | `/api/v1/cart` | Yes | PATIENT | *None* | Implemented | Passed (8/8) | Yes |
| Prescription | POST | `/api/v1/prescriptions` | Yes | PATIENT | `{"pharmacyId":"uuid (opt)","doctorName":"Dr X","files":[{"storageKey":"cloudinary_public_id","mimeType":"image/jpeg","sizeBytes":12000,"checksumSha256":"..."}]}` | Implemented | Passed (8/8) | Yes |
| Prescription | GET | `/api/v1/prescriptions/my` | Yes | PATIENT | *None* | Implemented | Passed (8/8) | Yes |
| Prescription | GET | `/api/v1/prescriptions/pharmacy/:pharmacyId` | Yes | SUPER_ADMIN, PHARMACY (own) | *None* | Implemented | Passed (8/8) | Yes |
| Prescription | PATCH | `/api/v1/prescriptions/:id/review` | Yes | SUPER_ADMIN, PHARMACY (own) | `{"status":"VERIFIED" \| "REJECTED","rejectionReason":"..."}` | Implemented | Passed (8/8) | Yes |
| Order | POST | `/api/v1/orders` | Yes | PATIENT | `{"addressId":"uuid","pharmacyId":"uuid (opt)","prescriptionId":"uuid (opt)","idempotencyKey":"key-1"}` | Implemented | Passed (8/8) | Yes |
| Order | GET | `/api/v1/orders/my` | Yes | PATIENT | *None* | Implemented | Passed (8/8) | Yes |
| Order | GET | `/api/v1/orders/pharmacy/:pharmacyId` | Yes | SUPER_ADMIN, PHARMACY (own) | *None* | Implemented | Passed (8/8) | Yes |
| Order | PATCH | `/api/v1/orders/:id/status` | Yes | SUPER_ADMIN, PHARMACY (own) | `{"status":"ACCEPTED" \| "PREPARING" \| "READY_FOR_PICKUP" \| "REJECTED"}` | Implemented | Passed (8/8) | Yes |
| Order | PATCH | `/api/v1/orders/:id/cancel` | Yes | PATIENT (own), SUPER_ADMIN | `{"cancelReason":"..."}` | Implemented | Passed (8/8) | Yes |
| Rider | POST | `/api/v1/riders/admin-create` | Yes | SUPER_ADMIN | `{"fullName":"Rider","phone":"9876543210","email":"r@x.com","password":"min8chars","vehicleType":"Bike","vehicleNumber":"WB39A1234"}` | Implemented | Passed (7/7) | Yes |
| Rider | GET | `/api/v1/riders` | Yes | SUPER_ADMIN | *None* | Implemented | Passed (7/7) | Yes |
| Rider | PATCH | `/api/v1/riders/:userId/status` | Yes | SUPER_ADMIN | `{"status":"AVAILABLE","kycStatus":"APPROVED"}` | Implemented | Passed (7/7) | Yes |
| Delivery | POST | `/api/v1/deliveries/assign` | Yes | SUPER_ADMIN | `{"riderId":"uuid","orderIds":["uuid"]}` | Implemented | Passed (7/7) | Yes |
| Delivery | GET | `/api/v1/deliveries/my` | Yes | RIDER | *None* | Implemented | Passed (7/7) | Yes |
| Delivery | POST | `/api/v1/deliveries/pickup-qr/scan` | Yes | RIDER | `{"qrToken":"QR-..."}` | Implemented | Passed (7/7) | Yes |
| Delivery | POST | `/api/v1/deliveries/:deliveryId/arrived` | Yes | RIDER | *None* | Implemented | Passed (7/7) | Yes |
| Delivery | GET | `/api/v1/deliveries/order/:orderId/otp` | Yes | PATIENT (own) | *None* | Implemented | Passed (7/7) | Yes |
| Delivery | POST | `/api/v1/deliveries/:deliveryId/complete` | Yes | RIDER | `{"otp":"123456"}` | Implemented | Passed (7/7) | Yes |
