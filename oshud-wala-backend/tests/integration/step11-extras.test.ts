import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/config/prisma';
import { generateAccessToken } from '../../src/utils/jwt.util';

jest.setTimeout(180000);

describe('Step 11: Coupons, Referral Coins & Support Tickets', () => {
    const adminPhone = '5555555761';
    const patient1Phone = '5555555762';
    const patient2Phone = '5555555763';
    const couponCode = 'OSHUD11TEST';

    let adminToken = '';
    let patient1Token = '';
    let patient2Token = '';
    let patient1Id = '';
    let couponId = '';
    let referralId = '';
    let ticketId = '';

    const cleanup = async () => {
        const users = await prisma.user.findMany({ where: { phone: { in: [adminPhone, patient1Phone, patient2Phone] } }, select: { id: true } });
        const userIds = users.map((u) => u.id);
        if (userIds.length > 0) {
            await prisma.supportMessage.deleteMany({ where: { senderId: { in: userIds } } });
            await prisma.supportTicket.deleteMany({ where: { userId: { in: userIds } } });
            const coinAccts = await prisma.coinAccount.findMany({ where: { userId: { in: userIds } }, select: { id: true } });
            if (coinAccts.length > 0) {
                await prisma.coinTransaction.deleteMany({ where: { accountId: { in: coinAccts.map((c) => c.id) } } });
                await prisma.coinAccount.deleteMany({ where: { id: { in: coinAccts.map((c) => c.id) } } });
            }
            await prisma.referral.deleteMany({ where: { OR: [{ referrerId: { in: userIds } }, { referredUserId: { in: userIds } }] } });
            await prisma.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
        }
        await prisma.coupon.deleteMany({ where: { code: couponCode } });
        if (userIds.length > 0) {
            await prisma.user.deleteMany({ where: { id: { in: userIds } } });
        }
    };

    beforeAll(async () => {
        await cleanup();
        const roles = await prisma.role.findMany();
        const roleMap = new Map(roles.map((r) => [r.name, r.id]));

        const [admin, p1, p2] = await Promise.all([
            prisma.user.create({ data: { fullName: 'Test S11 Admin', phone: adminPhone, passwordHash: 'hash', roleId: roleMap.get('SUPER_ADMIN')! } }),
            prisma.user.create({ data: { fullName: 'Test S11 Patient1', phone: patient1Phone, passwordHash: 'hash', roleId: roleMap.get('PATIENT')! } }),
            prisma.user.create({ data: { fullName: 'Test S11 Patient2', phone: patient2Phone, passwordHash: 'hash', roleId: roleMap.get('PATIENT')! } }),
        ]);

        patient1Id = p1.id;
        adminToken = generateAccessToken(admin.id, 'SUPER_ADMIN');
        patient1Token = generateAccessToken(p1.id, 'PATIENT');
        patient2Token = generateAccessToken(p2.id, 'PATIENT');
    });

    afterAll(async () => {
        await cleanup();
    });

    it('1. Super Admin creates PERCENT coupon with maxDiscountPaise cap (201)', async () => {
        const res = await request(app)
            .post('/api/v1/coupons')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                code: couponCode,
                description: '20% off up to ₹50',
                discountType: 'PERCENT',
                discountValue: 20,
                maxDiscountPaise: 5000,
                minOrderPaise: 10000,
                validFrom: new Date(Date.now() - 60000).toISOString(),
                validTo: new Date(Date.now() + 86400000).toISOString(),
            });
        expect(res.status).toBe(201);
        couponId = res.body.data.id;
    });

    it('2. Patient validates coupon -> respects minOrderPaise (400) and caps discount at 5000 paise (200)', async () => {
        const low = await request(app)
            .post('/api/v1/coupons/validate')
            .set('Authorization', `Bearer ${patient1Token}`)
            .send({ code: couponCode, subtotalPaise: 5000 });
        expect(low.status).toBe(400);

        const ok = await request(app)
            .post('/api/v1/coupons/validate')
            .set('Authorization', `Bearer ${patient1Token}`)
            .send({ code: couponCode, subtotalPaise: 50000 });
        expect(ok.status).toBe(200);
        expect(ok.body.data.discountPaise).toBe(5000);
        expect(ok.body.data.finalPaise).toBe(45000);
    });

    it('3. Patient 2 applies Patient 1 referral (201); self-referral fails (400)', async () => {
        const self = await request(app)
            .post('/api/v1/referrals/apply')
            .set('Authorization', `Bearer ${patient1Token}`)
            .send({ referrerId: patient1Id });
        expect(self.status).toBe(400);

        const ok = await request(app)
            .post('/api/v1/referrals/apply')
            .set('Authorization', `Bearer ${patient2Token}`)
            .send({ referrerId: patient1Id });
        expect(ok.status).toBe(201);
        referralId = ok.body.data.id;
    });

    it('4. Super Admin rewards referral -> credits 50 coins to Patient 1 CoinAccount (200)', async () => {
        const res = await request(app)
            .post(`/api/v1/referrals/${referralId}/reward`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ rewardCoins: 50 });
        expect(res.status).toBe(200);
        expect(res.body.data.referrerCoinBalance).toBe(50);

        const summary = await request(app).get('/api/v1/referrals/my').set('Authorization', `Bearer ${patient1Token}`);
        expect(summary.status).toBe(200);
        expect(summary.body.data.coinAccount.balance).toBe(50);
    });

    it('5. Patient 1 creates Support Ticket, Admin replies & resolves it (201, 200)', async () => {
        const create = await request(app)
            .post('/api/v1/support/tickets')
            .set('Authorization', `Bearer ${patient1Token}`)
            .send({ subject: 'Late delivery', message: 'Where is my order?', priority: 'HIGH' });
        expect(create.status).toBe(201);
        ticketId = create.body.data.id;

        const reply = await request(app)
            .post(`/api/v1/support/tickets/${ticketId}/messages`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ body: 'We are checking with the rider now.' });
        expect(reply.status).toBe(201);

        const resolve = await request(app)
            .patch(`/api/v1/support/tickets/${ticketId}/status`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ status: 'RESOLVED' });
        expect(resolve.status).toBe(200);
        expect(resolve.body.data.status).toBe('RESOLVED');
    });

    it('6. Patient 2 CANNOT view Patient 1 support ticket (403)', async () => {
        const res = await request(app)
            .get(`/api/v1/support/tickets/${ticketId}`)
            .set('Authorization', `Bearer ${patient2Token}`);
        expect(res.status).toBe(403);
    });
});
