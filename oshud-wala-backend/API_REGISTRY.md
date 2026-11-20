# API REGISTRY

| Module | Method | URL | Auth | Roles | Request Body (JSON Example) | Status | Auto Test | Approved |
|---|---|---|---|---|---|---|---|---|
| Auth | POST | `/api/v1/auth/register` | No | Public | `{"fullName": "Test", "phone": "9876543210", "password": "Pass"}` | Implemented | Passed | Yes |
| Auth | POST | `/api/v1/auth/login` | No | Public | `{"identifier": "9876543210", "password": "Pass"}` | Implemented | Passed | Yes |
| Auth | POST | `/api/v1/auth/refresh` | No | Public | `{"refreshToken": "token", "sessionId": "session"}` | Implemented | Passed | Yes |
| Auth | POST | `/api/v1/auth/logout` | Yes | All | `{"sessionId": "session_uuid_here"}` | Implemented | Passed | Yes |
| Notification | POST | `/api/v1/notifications/device-token` | Yes | All | `{"fcmToken": "abc", "deviceType": "ANDROID"}` | Implemented | Passed | Yes |
| Notification | POST | `/api/v1/notifications/device-token/remove`| Yes | All | `{"fcmToken": "abc"}` | Implemented | Passed | Yes |
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
| Pharmacy | GET | `/api/v1/pharmacies` | Yes | All | *None* | Implemented | Owner to retest | No |
| Pharmacy | POST | `/api/v1/pharmacies/admin-create` | Yes | SUPER_ADMIN | `{"name":"Shop","nameBn":"optional","nameHi":"optional","nameBn":"optional","nameHi":"optional","ownerName":"Owner","ownerEmail":"owner-email","ownerPassword":"min8chars","phone":"9876500001","locationId":"uuid","line1":"Main Road","latitude":23.5,"longitude":87.3}` | Implemented | Auto-tested | No |
| Pharmacy | PUT | `/api/v1/pharmacies/:id` | Yes | SUPER_ADMIN, PHARMACY (own only) | `{"name":"New Name","nameBn":"optional","nameHi":"optional","phone":"9876500001","line1":"Road","line2":null,"latitude":23.5,"longitude":87.3}` | Implemented | Auto-tested | No |
| Pharmacy | PUT | `/api/v1/pharmacies/admin-primary/:id` | Yes | SUPER_ADMIN | *None* | Implemented | Owner to retest | No |
| Doctor | GET | `/api/v1/doctors/pharmacy/:pharmacyId` | Yes | All (needs scoping later) | *None* | Implemented | Owner to retest | No |
| Doctor | POST | `/api/v1/doctors/onboard` | Yes | SUPER_ADMIN | `{"pharmacyId": "uuid", "fullName": "Dr X", "phone": "9876543211", "specializationId": "uuid", "registrationNumber": "WB123"}` | Implemented | Owner to retest | No |
| Location | GET | `/api/v1/locations` | No | Public | query: city, state, q, page, limit (active only) | Implemented | Owner to test | No |
| Location | GET | `/api/v1/locations/:id` | No | Public | *None* (active only) | Implemented | Owner to test | No |
| Location | GET | `/api/v1/locations/admin/all` | Yes | SUPER_ADMIN | query: isActive, city, state, q, page, limit | Implemented | Owner to test | No |
| Location | POST | `/api/v1/locations` | Yes | SUPER_ADMIN | `{"city":"Durgapur","area":"City Centre","state":"West Bengal","pincode":"713216","latitude":23.5204,"longitude":87.3119}` | Implemented | Owner to test | No |
| Location | PUT | `/api/v1/locations/:id` | Yes | SUPER_ADMIN | `{"area":"Bidhannagar"}` | Implemented | Owner to test | No |
| Location | PATCH | `/api/v1/locations/:id/status` | Yes | SUPER_ADMIN | `{"isActive":false}` | Implemented | Owner to test | No |
| Pharmacy | GET | `/api/v1/pharmacies/my` | Yes | PHARMACY | *None* | Implemented | Auto-tested | No |

| Pharmacy | PUT | `/api/v1/pharmacies/admin-update/:id` | Yes | SUPER_ADMIN | `{"locationId": "uuid", "status": "ACTIVE" \| "SUSPENDED"}` | Implemented | Passed (15/15) | Yes |

*Note: Detailed API descriptions and live testing are available via the Swagger UI at `https://oshudwalla-backend-1.onrender.com/docs` (Live) or `http://localhost:8000/docs` (Local).*