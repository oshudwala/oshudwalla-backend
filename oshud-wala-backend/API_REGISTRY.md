# API REGISTRY

| Module | Method | URL | Auth Required | Roles | Status | Automated Test | User Approved |
|---|---|---|---|---|---|---|---|
| Auth | POST | `/api/v1/auth/register` | No | Public | Implemented | Passed | Yes |
| Auth | POST | `/api/v1/auth/login` | No | Public | Implemented | Passed | Yes |
| Auth | POST | `/api/v1/auth/refresh` | No | Public | Implemented | Passed | Yes |
| Auth | POST | `/api/v1/auth/logout` | Yes | All | Implemented | Passed | Yes |

*Note: Detailed API payloads and descriptions are available via the Swagger UI at `http://localhost:6000/docs`.*