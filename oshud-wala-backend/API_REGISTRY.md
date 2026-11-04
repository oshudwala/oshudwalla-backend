# API REGISTRY

| Module | Method | URL | Auth | Roles | Request Body (JSON Example) | Status | Auto Test | Approved |
|---|---|---|---|---|---|---|---|---|
| Auth | POST | `/api/v1/auth/register` | No | Public | `{"fullName": "Test Patient", "phone": "9876543210", "password": "Password123"}` | Implemented | Passed | Yes |
| Auth | POST | `/api/v1/auth/login` | No | Public | `{"identifier": "9876543210", "password": "Password123"}` | Implemented | Passed | Yes |
| Auth | POST | `/api/v1/auth/refresh` | No | Public | `{"refreshToken": "token_string_here", "sessionId": "session_uuid_here"}` | Implemented | Passed | Yes |
| Auth | POST | `/api/v1/auth/logout` | Yes | All | `{"sessionId": "session_uuid_here"}` | Implemented | Passed | Yes |
| Notification | POST | `/api/v1/notifications/device-token` | Yes | All | `{"fcmToken": "abc123token", "deviceType": "ANDROID", "deviceId": "device_123"}` | In Progress | Pending | Pending |
| Notification | POST | `/api/v1/notifications/device-token/remove`| Yes | All | `{"fcmToken": "abc123token"}` | In Progress | Pending | Pending |

*Note: Detailed API descriptions and live testing are available via the Swagger UI at `https://oshudwalla-backend-1.onrender.com/docs` (Live) or `http://localhost:8000/docs` (Local).*