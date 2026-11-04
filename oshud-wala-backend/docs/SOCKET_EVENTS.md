# Socket.IO Event Registry (Phase 3 draft)

## 1. Connection and authentication
- Namespace: `/` (single namespace; rooms provide isolation).
- Client connects with the JWT access token (`auth: { token }`). Server verifies it and the session is not revoked. Invalid or expired token: connection refused. On token refresh the client reconnects.
- Redis adapter so multiple API instances share rooms.
- Clients **cannot join arbitrary rooms.** The server joins the socket to rooms after authorization; a `subscribe:*` client event is validated against ownership/scope rules.

## 2. Rooms
| Room | Joined by | Purpose |
|---|---|---|
| `user:{userId}` | Every user on connect | Personal notifications and updates |
| `order:{orderId}` | Owning patient, assigned rider, pharmacy staff of that order, Super Admin | Order status |
| `pharmacy:{pharmacyId}` | Pharmacists of that pharmacy | New orders and prescriptions |
| `clinic:{clinicId}` | Clinic Admin, Receptionist, Doctors of that clinic | Appointments and prescriptions |
| `queue:{doctorClinicId}:{yyyy-mm-dd}` | Patients with an appointment that day, clinic staff, that doctor | Live queue |
| `role:SUPER_ADMIN` | Super Admins | Operations feed |
| `rider:{riderId}` | The rider | Assignments |

## 3. Server-to-client events
Every payload carries `eventId` (uuid), `occurredAt` (ISO), and where relevant `orderId`. Payloads never contain OTP values, QR tokens, passwords, or prescription file URLs.

| Event | Rooms | Payload (summary) | Trigger |
|---|---|---|---|
| `notification:new` | `user:{id}` | notificationId, type, title, body (generic if sensitive) | Any persisted notification |
| `order:created` | `pharmacy:{id}`, `role:SUPER_ADMIN` | orderId, orderNumber | Checkout |
| `order:status_changed` | `order:{id}`, `user:{patientId}` | orderId, from, to | Any order transition |
| `order:confirmation_required` | `user:{patientId}` | orderId, quotation summary | Pharmacist requests confirmation |
| `prescription:status_changed` | `user:{patientId}`, `pharmacy:{id}`, `clinic:{id}` | prescriptionId, from, to | Prescription transition |
| `delivery:assigned` | `rider:{riderId}`, `role:SUPER_ADMIN` | batchId, orderIds | Bulk assignment |
| `delivery:unassigned` | `rider:{riderId}` | orderId | Reassignment |
| `delivery:status_changed` | `order:{id}`, `role:SUPER_ADMIN` | deliveryId, from, to | Delivery transition |
| `delivery:otp_ready` | `user:{customerId}` | orderId, expiresAt (**no code**) | Rider marks ARRIVED |
| `delivery:otp_failed_attempt` | `rider:{riderId}` | orderId, attemptsLeft | Wrong OTP |
| `delivery:completed` | `order:{id}`, `user:{customerId}`, `rider:{riderId}`, `role:SUPER_ADMIN` | orderId, deliveredAt | OTP verified |
| `queue:updated` | `queue:{dc}:{date}` | currentToken, waitingCount, status | Call next / pause |
| `queue:your_turn_soon` | `user:{patientId}` | appointmentId, tokensAhead | Queue progress |
| `appointment:status_changed` | `user:{patientId}`, `clinic:{id}` | appointmentId, from, to | Appointment transition |
| `wallet:updated` | `user:{ownerId}` | walletId, newBalance | Ledger posting |
| `withdrawal:status_changed` | `user:{requesterId}`, `role:SUPER_ADMIN` | withdrawalId, status | Withdrawal transition |
| `cash:deposit_status_changed` | `rider:{riderId}`, `role:SUPER_ADMIN` | depositId, status | Deposit verification |

## 4. Client-to-server events
| Event | Sender | Purpose |
|---|---|---|
| `subscribe:order` | Authorized user | Join `order:{id}` after ownership/scope check |
| `subscribe:queue` | Patient with appointment, staff | Join a queue room after check |
| `rider:location` | Rider | Throttled location update (also available via REST) |
| `ack` | Any | Acknowledge `eventId` (optional, for delivery tracking) |

## 5. Reliability and recovery
- Sockets are a **delivery optimization, not the source of truth.** Every important event is also a persisted notification and/or reflected in REST state.
- After reconnect, the client calls `GET /api/v1/notifications?since=<lastEventTime>` and refetches the current resource (order, queue, delivery) to heal any gap.
- The in-app OTP flow works with sockets down: the customer opens Order Tracking and reads the OTP from the authenticated REST endpoint; the rider submits via REST.
- Push notification previews for sensitive types (`isSensitive = true`) show generic text only.

## 6. Security
Per-event rate limits, payload size limits, room-join authorization, no broadcast of personal data to shared rooms, disconnect on session revocation.
