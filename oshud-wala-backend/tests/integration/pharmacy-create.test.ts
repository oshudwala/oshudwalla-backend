import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/config/prisma';

jest.setTimeout(120000);

describe('Step 3A-3: Pharmacy + owner account in one step', () => {
    const admin = { fullName: 'P3A3 Admin', phone: '5555555601', password: 'Password123' };
    const patient = { fullName: 'P3A3 Patient', phone: '5555555602', password: 'Password123' };
    const fakeId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
    const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

    let adminToken = '', patientToken = '', ownerToken = '';
    let locId = '', inactiveLocId = '';
    let n = 0;
    let first: any = null;
    let firstBody: any = null;
    let second: any = null;

    const body = (over: any = {}) => {
        n++;
        return {
            name: `Test P3A3 Pharmacy ${n}`,
            ownerName: 'Test P3A3 Owner',
            ownerEmail: `p3a3.owner${n}@example.com`,
            ownerPassword: 'Password123',
            phone: `55555566${String(n).padStart(2, '0')}`,
            locationId: locId,
            line1: 'Main Road',
            ...over,
        };
    };
    const create = (token: string, b: any) => request(app).post('/api/v1/pharmacies/admin-create').set(auth(token)).send(b);
    const login = (identifier: string, password: string) => request(app).post('/api/v1/auth/login').send({ identifier, password });

    const cleanup = async () => {
        await prisma.pharmacy.deleteMany({ where: { name: { startsWith: 'Test P3A3' } } });
        await prisma.location.deleteMany({ where: { city: { startsWith: 'Test P3A3' } } });
        const users = await prisma.user.findMany({
            where: { OR: [{ phone: { in: [admin.phone, patient.phone] } }, { phone: { startsWith: '55555566' } }, { email: { startsWith: 'p3a3.' } }] },
            select: { id: true },
        });
        const ids = users.map((u) => u.id);
        if (ids.length) {
            try { await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } }); } catch {}
            await prisma.user.deleteMany({ where: { id: { in: ids } } });
        }
    };

    beforeAll(async () => {
        await cleanup();
        await request(app).post('/api/v1/auth/register').send(admin);
        await request(app).post('/api/v1/auth/register').send(patient);
        const role = await prisma.role.upsert({ where: { name: 'SUPER_ADMIN' }, update: {}, create: { name: 'SUPER_ADMIN' } });
        await prisma.user.update({ where: { phone: admin.phone }, data: { roleId: role.id } });
        adminToken = (await login(admin.phone, admin.password)).body.data.accessToken;
        patientToken = (await login(patient.phone, patient.password)).body.data.accessToken;

        const l1 = await request(app).post('/api/v1/locations').set(auth(adminToken))
            .send({ city: 'Test P3A3 City', area: 'Centre', state: 'West Bengal', pincode: '713216' });
        locId = l1.body.data.id;
        const l2 = await request(app).post('/api/v1/locations').set(auth(adminToken))
            .send({ city: 'Test P3A3 Off', area: 'Old', state: 'West Bengal', pincode: '713217' });
        inactiveLocId = l2.body.data.id;
        await request(app).patch(`/api/v1/locations/${inactiveLocId}/status`).set(auth(adminToken)).send({ isActive: false });
    });

    afterAll(async () => {
        await cleanup();
        await prisma.$disconnect();
    });

    it('1. Super Admin creates pharmacy + owner account (201)', async () => {
        firstBody = body();
        const res = await create(adminToken, firstBody);
        expect(res.status).toBe(201);
        first = res.body.data;
        expect(first.locationId).toBe(locId);
        expect(first.city).toBe('Test P3A3 City');
        expect(first.state).toBe('West Bengal');
        expect(first.pincode).toBe('713216');
        expect(first.isPrimary).toBe(false);
        expect(first.owner.email).toBe(firstBody.ownerEmail);
        // password and hash must never come back
        const text = JSON.stringify(res.body);
        expect(text).not.toContain('passwordHash');
        expect(text).not.toContain(firstBody.ownerPassword);
        // database checks
        const user = await prisma.user.findUnique({ where: { email: firstBody.ownerEmail }, include: { role: true } });
        expect(user?.role.name).toBe('PHARMACY');
        expect(user?.passwordHash).not.toBe(firstBody.ownerPassword);
        const link = await prisma.pharmacyStaff.findFirst({ where: { userId: user!.id, pharmacyId: first.id, staffRole: 'OWNER' } });
        expect(link).not.toBeNull();
    });

    it('2. owner logs in with email + password (200, role PHARMACY)', async () => {
        const res = await login(firstBody.ownerEmail, firstBody.ownerPassword);
        expect(res.status).toBe(200);
        expect(res.body.data.user.role).toBe('PHARMACY');
        ownerToken = res.body.data.accessToken;
    });

    it('3. owner logs in with phone + password (200)', async () => {
        const res = await login(firstBody.phone, firstBody.ownerPassword);
        expect(res.status).toBe(200);
    });

    it('4. owner sees only own pharmacy on /my (200)', async () => {
        const res = await request(app).get('/api/v1/pharmacies/my').set(auth(ownerToken));
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0].id).toBe(first.id);
    });

    it('5. a second pharmacy owner cannot see the first pharmacy', async () => {
        const b2 = body();
        const created = await create(adminToken, b2);
        expect(created.status).toBe(201);
        second = created.body.data;
        const token2 = (await login(b2.ownerEmail, b2.ownerPassword)).body.data.accessToken;
        const res = await request(app).get('/api/v1/pharmacies/my').set(auth(token2));
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0].id).toBe(second.id);
        expect(res.body.data.some((p: any) => p.id === first.id)).toBe(false);
    });

    it('6. duplicate owner email (409) and no pharmacy is created', async () => {
        const dup = body({ ownerEmail: firstBody.ownerEmail });
        const res = await create(adminToken, dup);
        expect(res.status).toBe(409);
        expect(await prisma.pharmacy.count({ where: { name: dup.name } })).toBe(0);
    });

    it('7. duplicate owner phone (409) and no pharmacy is created', async () => {
        const dup = body({ phone: firstBody.phone });
        const res = await create(adminToken, dup);
        expect(res.status).toBe(409);
        expect(await prisma.pharmacy.count({ where: { name: dup.name } })).toBe(0);
    });

    it('8. phone of an existing Patient account (409)', async () => {
        const res = await create(adminToken, body({ phone: patient.phone }));
        expect(res.status).toBe(409);
    });

    it('9. missing password (400)', async () => {
        const { ownerPassword, ...rest } = body();
        const res = await create(adminToken, rest);
        expect(res.status).toBe(400);
    });

    it('10. short password (400)', async () => {
        const res = await create(adminToken, body({ ownerPassword: '123' }));
        expect(res.status).toBe(400);
    });

    it('11. invalid owner email (400)', async () => {
        const res = await create(adminToken, body({ ownerEmail: 'abc' }));
        expect(res.status).toBe(400);
    });

    it('12. missing locationId (400)', async () => {
        const { locationId, ...rest } = body();
        const res = await create(adminToken, rest);
        expect(res.status).toBe(400);
    });

    it('13. unknown locationId (404)', async () => {
        const res = await create(adminToken, body({ locationId: fakeId }));
        expect(res.status).toBe(404);
    });

    it('14. inactive location (400)', async () => {
        const res = await create(adminToken, body({ locationId: inactiveLocId }));
        expect(res.status).toBe(400);
    });

    it('15. latitude without longitude (400)', async () => {
        const res = await create(adminToken, body({ latitude: 22.5 }));
        expect(res.status).toBe(400);
    });

    it('16. latitude + longitude saved (201)', async () => {
        const res = await create(adminToken, body({ latitude: 23.5204, longitude: 87.3119 }));
        expect(res.status).toBe(201);
        expect(Number(res.body.data.latitude)).toBeCloseTo(23.5204, 4);
        expect(Number(res.body.data.longitude)).toBeCloseTo(87.3119, 4);
    });

    it('17. Patient cannot create pharmacy (403)', async () => {
        const res = await create(patientToken, body());
        expect(res.status).toBe(403);
    });

    it('18. a pharmacy owner cannot create another pharmacy (403)', async () => {
        const res = await create(ownerToken, body());
        expect(res.status).toBe(403);
    });

    it('19. audit log has PHARMACY_CREATED', async () => {
        const log = await prisma.auditLog.findFirst({ where: { entityType: 'Pharmacy', entityId: first.id, action: 'PHARMACY_CREATED' } });
        expect(log).not.toBeNull();
    });
});
