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

*Note: Detailed API descriptions and live testing are available via the Swagger UI at `https://oshudwalla-backend-1.onrender.com/docs` (Live) or `http://localhost:8000/docs` (Local).*