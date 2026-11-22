import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/config/prisma';
import { generateAccessToken } from '../../src/utils/jwt.util';

jest.setTimeout(180000);

describe('Step 9: Rider Account (Super Admin), Bulk Assign, Pickup QR, In-App OTP & ₹40 Earning', () => {
    const adminPhone = '5555555741';
    const patientPhone = '5555555742';
    const riderPhone = '5555555743';
    const riderEmail = 's9.rider@test.com';
    const phPhone = '5555557951';
    const password = 'Password123!';

    let adminToken = '';
    let patientToken = '';
    let riderToken = '';
    let riderUserId = '';
    let orderId = '';
    let deliveryId = '';
    let qrToken = '';
    let deliveryOtp = '';

    const cleanup = async () => {
        const users = await prisma.user.findMany({
            where: { OR: [{ phone: { in: [adminPhone, patientPhone, riderPhone] } }, { email: riderEmail }] },
            select: { id: true },
        });
        const userIds = users.map((u) => u.id);
        if (userIds.length > 0) {
            const orders = await prisma.order.findMany({ where: { patientId: { in: userIds } }, select: { id: true } });
            const orderIds = orders.map((o) => o.id);
            const wallets = await prisma.wallet.findMany({ where: { userId: { in: userIds } }, select: { id: true } });
            const walletIds = wallets.map((w) => w.id);
            const batches = await prisma.deliveryBatch.findMany({ where: { riderId: { in: userIds } }, select: { id: true } });
            const batchIds = batches.map((b) => b.id);

            if (walletIds.length > 0) {
                await prisma.ledgerEntry.deleteMany({ where: { walletId: { in: walletIds } } });
            }
            if (orderIds.length > 0) {
                await prisma.ledgerTransaction.deleteMany({ where: { referenceId: { in: orderIds } } });
                await prisma.cashCollection.deleteMany({ where: { orderId: { in: orderIds } } });
                await prisma.deliveryOtp.deleteMany({ where: { orderId: { in: orderIds } } });
                await prisma.delivery.deleteMany({ where: { orderId: { in: orderIds } } });
                await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
            }
            if (batchIds.length > 0) {
                await prisma.pickupQr.deleteMany({ where: { batchId: { in: batchIds } } });
                await prisma.deliveryBatch.deleteMany({ where: { id: { in: batchIds } } });
            }
            if (walletIds.length > 0) {
                await prisma.wallet.deleteMany({ where: { id: { in: walletIds } } });
            }
            await prisma.riderProfile.deleteMany({ where: { userId: { in: userIds } } });
            await prisma.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
            await prisma.user.deleteMany({ where: { id: { in: userIds } } });
        }
        await prisma.pharmacy.deleteMany({ where: { phone: phPhone } });
    };

    beforeAll(async () => {
        await cleanup();
        const roles = await prisma.role.findMany();
        const roleMap = new Map(roles.map((r) => [r.name, r.id]));

        const [admin, patient, pharmacy] = await Promise.all([
            prisma.user.create({ data: { fullName: 'Test S9 Admin', phone: adminPhone, passwordHash: 'hash', roleId: roleMap.get('SUPER_ADMIN')! } }),
            prisma.user.create({ data: { fullName: 'Test S9 Patient', phone: patientPhone, passwordHash: 'hash', roleId: roleMap.get('PATIENT')! } }),
            prisma.pharmacy.create({
                data: { name: 'Test S9 Pharmacy', phone: phPhone, line1: 'Main Rd', city: 'Durgapur', state: 'WB', pincode: '713216', status: 'ACTIVE' },
            }),
        ]);

        adminToken = generateAccessToken(admin.id, 'SUPER_ADMIN');
        patientToken = generateAccessToken(patient.id, 'PATIENT');

        const order = await prisma.order.create({
            data: {
                orderNumber: `ORD-S9-${Date.now()}`,
                patientId: patient.id,
                pharmacyId: pharmacy.id,
                deliveryAddress: { line1: 'City Centre', city: 'Durgapur', pincode: '713216' },
                status: 'READY_FOR_PICKUP',
                paymentMethod: 'COD',
                paymentStatus: 'PENDING',
                subtotalPaise: 25000,
                totalPaise: 25000,
            },
        });
        orderId = order.id;
    });

    afterAll(async () => {
        await cleanup();
    });

    it('1. Super Admin creates Rider account + RiderProfile + Wallet (201)', async () => {
        const res = await request(app)
            .post('/api/v1/riders/admin-create')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                fullName: 'Test S9 Rider',
                phone: riderPhone,
                email: riderEmail,
                password,
                vehicleType: 'Bike',
                vehicleNumber: 'WB39A1234',
            });
        expect(res.status).toBe(201);
        riderUserId = res.body.data.user.id;
        riderToken = generateAccessToken(riderUserId, 'RIDER');
    });

    it('2. Super Admin assigns READY_FOR_PICKUP order to Rider & generates Pickup QR (201)', async () => {
        const res = await request(app)
            .post('/api/v1/deliveries/assign')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ riderId: riderUserId, orderIds: [orderId] });
        expect(res.status).toBe(201);
        expect(res.body.data.deliveries).toHaveLength(1);
        expect(res.body.data.pickupQrs).toHaveLength(1);
        deliveryId = res.body.data.deliveries[0].id;
        qrToken = res.body.data.pickupQrs[0].qrToken;
    });

    it('3. Rider scans Pickup QR (single-use) -> order moves to SHIPPED (200)', async () => {
        const res = await request(app)
            .post('/api/v1/deliveries/pickup-qr/scan')
            .set('Authorization', `Bearer ${riderToken}`)
            .send({ qrToken });
        expect(res.status).toBe(200);
        expect(res.body.data.pickedUpCount).toBe(1);

        // Second scan of same QR must fail (single-use)
        const reuse = await request(app)
            .post('/api/v1/deliveries/pickup-qr/scan')
            .set('Authorization', `Bearer ${riderToken}`)
            .send({ qrToken });
        expect(reuse.status).toBe(400);
    });

    it('4. Rider marks ARRIVED -> generates In-App OTP (NOT returned to rider) (200)', async () => {
        const res = await request(app)
            .post(`/api/v1/deliveries/${deliveryId}/arrived`)
            .set('Authorization', `Bearer ${riderToken}`);
        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe('ARRIVED');
        expect(res.body.data.otp).toBeUndefined();
    });

    it('5. Rider CANNOT read customer OTP endpoint (403); owning Patient reads OTP (200)', async () => {
        const forbidden = await request(app)
            .get(`/api/v1/deliveries/order/${orderId}/otp`)
            .set('Authorization', `Bearer ${riderToken}`);
        expect(forbidden.status).toBe(403);

        const ok = await request(app)
            .get(`/api/v1/deliveries/order/${orderId}/otp`)
            .set('Authorization', `Bearer ${patientToken}`);
        expect(ok.status).toBe(200);
        expect(ok.body.data.otp).toMatch(/^\d{6}$/);
        deliveryOtp = ok.body.data.otp;
    });

    it('6. Wrong OTP fails with 400; Valid OTP completes delivery, records COD CashCollection & credits ₹40 (4000 paise) (200)', async () => {
        const wrong = await request(app)
            .post(`/api/v1/deliveries/${deliveryId}/complete`)
            .set('Authorization', `Bearer ${riderToken}`)
            .send({ otp: '000000' });
        expect(wrong.status).toBe(400);

        const done = await request(app)
            .post(`/api/v1/deliveries/${deliveryId}/complete`)
            .set('Authorization', `Bearer ${riderToken}`)
            .send({ otp: deliveryOtp });
        expect(done.status).toBe(200);
        expect(done.body.data.status).toBe('DELIVERED');
        expect(done.body.data.riderEarningPaise).toBe(4000);
        expect(done.body.data.codCollectedPaise).toBe(25000);
        expect(done.body.data.walletBalancePaise).toBe('4000');

        // Verify CashCollection & LedgerEntry exist
        const cash = await prisma.cashCollection.findUnique({ where: { orderId } });
        expect(cash?.amountPaise).toBe(25000);
        expect(cash?.status).toBe('COLLECTED');
    });

    it('7. Completing already delivered order again fails with 400 (no duplicate ₹40 credit)', async () => {
        const dup = await request(app)
            .post(`/api/v1/deliveries/${deliveryId}/complete`)
            .set('Authorization', `Bearer ${riderToken}`)
            .send({ otp: deliveryOtp });
        expect(dup.status).toBe(400);
    });
});
