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
| Pharmacy | POST | `/api/v1/pharmacies/admin-create` | Yes | SUPER_ADMIN | `{"name": "Oshud Wala", "phone": "9876543210", "line1": "City Center", "city": "Durgapur", "state": "WB", "pincode": "713216", "isPrimary": true}` | Implemented | Owner to retest | No |
| Pharmacy | PUT | `/api/v1/pharmacies/admin-primary/:id` | Yes | SUPER_ADMIN | *None* | Implemented | Owner to retest | No |
| Doctor | GET | `/api/v1/doctors/pharmacy/:pharmacyId` | Yes | All (needs scoping later) | *None* | Implemented | Owner to retest | No |
| Doctor | POST | `/api/v1/doctors/onboard` | Yes | SUPER_ADMIN | `{"pharmacyId": "uuid", "fullName": "Dr X", "phone": "9876543211", "specializationId": "uuid", "registrationNumber": "WB123"}` | Implemented | Owner to retest | No |

*Note: Detailed API descriptions and live testing are available via the Swagger UI at `https://oshudwalla-backend-1.onrender.com/docs` (Live) or `http://localhost:8000/docs` (Local).*