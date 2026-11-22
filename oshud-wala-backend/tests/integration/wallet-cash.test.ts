import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/config/prisma';
import { generateAccessToken } from '../../src/utils/jwt.util';

jest.setTimeout(180000);

describe('Step 10: Wallet, Withdrawals (Ledger) & COD Cash Deposit Settlements', () => {
    const adminPhone = '5555555751';
    const riderPhone = '5555555752';
    const patientPhone = '5555555753';
    const phPhone = '5555557961';

    let adminToken = '';
    let riderToken = '';
    let withdrawal1Id = '';
    let withdrawal2Id = '';
    let collectionId = '';
    let depositId = '';

    const cleanup = async () => {
        const users = await prisma.user.findMany({ where: { phone: { in: [adminPhone, riderPhone, patientPhone] } }, select: { id: true } });
        const userIds = users.map((u) => u.id);
        if (userIds.length > 0) {
            const wallets = await prisma.wallet.findMany({ where: { userId: { in: userIds } }, select: { id: true } });
            const walletIds = wallets.map((w) => w.id);
            const wReqs = await prisma.withdrawalRequest.findMany({ where: { requestedById: { in: userIds } }, select: { id: true } });
            const wReqIds = wReqs.map((w) => w.id);
            const deposits = await prisma.cashDeposit.findMany({ where: { riderId: { in: userIds } }, select: { id: true } });
            const depIds = deposits.map((d) => d.id);

            await prisma.settlement.deleteMany({
                where: { OR: [{ withdrawalRequestId: { in: wReqIds } }, { cashDepositId: { in: depIds } }] },
            });
            if (walletIds.length > 0) {
                await prisma.ledgerEntry.deleteMany({ where: { walletId: { in: walletIds } } });
            }
            if (wReqIds.length > 0) {
                await prisma.ledgerTransaction.deleteMany({ where: { referenceId: { in: wReqIds } } });
                await prisma.withdrawalRequest.deleteMany({ where: { id: { in: wReqIds } } });
            }
            await prisma.cashCollection.deleteMany({ where: { riderId: { in: userIds } } });
            await prisma.cashDeposit.deleteMany({ where: { riderId: { in: userIds } } });
            await prisma.order.deleteMany({ where: { patientId: { in: userIds } } });
            if (walletIds.length > 0) {
                await prisma.wallet.deleteMany({ where: { id: { in: walletIds } } });
            }
            await prisma.user.deleteMany({ where: { id: { in: userIds } } });
        }
        await prisma.pharmacy.deleteMany({ where: { phone: phPhone } });
    };

    beforeAll(async () => {
        await cleanup();
        const roles = await prisma.role.findMany();
        const roleMap = new Map(roles.map((r) => [r.name, r.id]));

        const [admin, rider, patient, pharmacy] = await Promise.all([
            prisma.user.create({ data: { fullName: 'Test S10 Admin', phone: adminPhone, passwordHash: 'hash', roleId: roleMap.get('SUPER_ADMIN')! } }),
            prisma.user.create({ data: { fullName: 'Test S10 Rider', phone: riderPhone, passwordHash: 'hash', roleId: roleMap.get('RIDER')! } }),
            prisma.user.create({ data: { fullName: 'Test S10 Patient', phone: patientPhone, passwordHash: 'hash', roleId: roleMap.get('PATIENT')! } }),
            prisma.pharmacy.create({
                data: { name: 'Test S10 Pharm', phone: phPhone, line1: 'Main Rd', city: 'Durgapur', state: 'WB', pincode: '713216', status: 'ACTIVE' },
            }),
        ]);

        adminToken = generateAccessToken(admin.id, 'SUPER_ADMIN');
        riderToken = generateAccessToken(rider.id, 'RIDER');

        // Seed rider wallet with ₹100 (10000 paise)
        await prisma.wallet.create({
            data: { ownerKey: `RIDER:${rider.id}`, ownerType: 'RIDER', userId: rider.id, balancePaise: BigInt(10000), heldPaise: BigInt(0) },
        });

        // Seed a delivered order + COD CashCollection of ₹250 (25000 paise)
        const order = await prisma.order.create({
            data: {
                orderNumber: `ORD-S10-${Date.now()}`,
                patientId: patient.id,
                pharmacyId: pharmacy.id,
                deliveryAddress: { line1: 'City Centre' },
                status: 'DELIVERED',
                paymentMethod: 'COD',
                paymentStatus: 'COLLECTED',
                subtotalPaise: 25000,
                totalPaise: 25000,
            },
        });
        const cc = await prisma.cashCollection.create({
            data: { orderId: order.id, riderId: rider.id, amountPaise: 25000, status: 'COLLECTED' },
        });
        collectionId = cc.id;
    });

    afterAll(async () => {
        await cleanup();
    });

    it('1. Rider views own wallet balance (10000 paise) (200)', async () => {
        const res = await request(app).get('/api/v1/wallet/my').set('Authorization', `Bearer ${riderToken}`);
        expect(res.status).toBe(200);
        expect(res.body.data.balancePaise).toBe('10000');
        expect(res.body.data.heldPaise).toBe('0');
    });

    it('2. Requesting withdrawal exceeding balance fails with 400', async () => {
        const res = await request(app)
            .post('/api/v1/wallet/withdrawals')
            .set('Authorization', `Bearer ${riderToken}`)
            .send({ amountPaise: 50000, payoutDetails: { method: 'UPI', upiId: 'rider@upi' } });
        expect(res.status).toBe(400);
    });

    it('3. Rider requests ₹40 (4000 paise) withdrawal -> balance becomes 6000, held becomes 4000 (201)', async () => {
        const res = await request(app)
            .post('/api/v1/wallet/withdrawals')
            .set('Authorization', `Bearer ${riderToken}`)
            .send({ amountPaise: 4000, payoutDetails: { method: 'UPI', upiId: 'rider@upi' }, idempotencyKey: 'wd-s10-1' });
        expect(res.status).toBe(201);
        withdrawal1Id = res.body.data.id;

        const w = await request(app).get('/api/v1/wallet/my').set('Authorization', `Bearer ${riderToken}`);
        expect(w.body.data.balancePaise).toBe('6000');
        expect(w.body.data.heldPaise).toBe('4000');
    });

    it('4. Super Admin marks withdrawal PAID -> held becomes 0 and Settlement created (200)', async () => {
        const res = await request(app)
            .patch(`/api/v1/wallet/withdrawals/${withdrawal1Id}/review`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ decision: 'PAID', method: 'UPI', referenceNo: 'UTR123456' });
        expect(res.status).toBe(200);
        expect(res.body.data.withdrawal.status).toBe('PAID');
        expect(res.body.data.settlement.type).toBe('WITHDRAWAL_PAYOUT');

        const w = await request(app).get('/api/v1/wallet/my').set('Authorization', `Bearer ${riderToken}`);
        expect(w.body.data.balancePaise).toBe('6000');
        expect(w.body.data.heldPaise).toBe('0');
    });

    it('5. Rejected withdrawal releases held funds back to balancePaise (200)', async () => {
        const req2 = await request(app)
            .post('/api/v1/wallet/withdrawals')
            .set('Authorization', `Bearer ${riderToken}`)
            .send({ amountPaise: 2000, payoutDetails: { method: 'UPI', upiId: 'bad@upi' } });
        withdrawal2Id = req2.body.data.id;

        const rej = await request(app)
            .patch(`/api/v1/wallet/withdrawals/${withdrawal2Id}/review`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ decision: 'REJECTED', rejectionReason: 'Invalid UPI ID' });
        expect(rej.status).toBe(200);
        expect(rej.body.data.withdrawal.status).toBe('REJECTED');

        const w = await request(app).get('/api/v1/wallet/my').set('Authorization', `Bearer ${riderToken}`);
        expect(w.body.data.balancePaise).toBe('6000');
        expect(w.body.data.heldPaise).toBe('0');
    });

    it('6. Rider submits COD cash deposit (25000 paise) & Super Admin verifies it (201, 200)', async () => {
        const cashRes = await request(app).get('/api/v1/cash/my').set('Authorization', `Bearer ${riderToken}`);
        expect(cashRes.status).toBe(200);
        expect(cashRes.body.data.pendingCashPaise).toBe(25000);

        const dep = await request(app)
            .post('/api/v1/cash/deposits')
            .set('Authorization', `Bearer ${riderToken}`)
            .send({ collectionIds: [collectionId], method: 'UPI', referenceNo: 'COD-UTR-999' });
        expect(dep.status).toBe(201);
        expect(dep.body.data.amountPaise).toBe(25000);
        depositId = dep.body.data.id;

        const ver = await request(app)
            .patch(`/api/v1/cash/deposits/${depositId}/verify`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ decision: 'VERIFIED' });
        expect(ver.status).toBe(200);
        expect(ver.body.data.deposit.status).toBe('VERIFIED');
        expect(ver.body.data.settlement.type).toBe('COD_CASH_DEPOSIT');
    });
});
