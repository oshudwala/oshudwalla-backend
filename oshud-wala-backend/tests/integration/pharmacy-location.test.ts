import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/config/prisma';

jest.setTimeout(60000);

describe('Step 3A: Pharmacy + Location link', () => {
    const admin = { fullName: 'P3A Admin', phone: '5555555581', password: 'Password123' };
    const base = { name: 'Test P3A Pharmacy', phone: '9876500001', line1: 'Main Road' };
    const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
    let adminToken = '';
    let locId = '';
    let inactiveLocId = '';
    let linkedPharmacyId = '';

    const cleanup = async () => {
        await prisma.pharmacy.deleteMany({ where: { name: { startsWith: 'Test P3A' } } });
        await prisma.location.deleteMany({ where: { city: { startsWith: 'Test P3A' } } });
        const users = await prisma.user.findMany({ where: { phone: admin.phone }, select: { id: true } });
        const ids = users.map((u) => u.id);
        if (ids.length) {
            try { await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } }); } catch {}
            await prisma.user.deleteMany({ where: { id: { in: ids } } });
        }
    };

    beforeAll(async () => {
        await cleanup();
        await request(app).post('/api/v1/auth/register').send(admin);
        const role = await prisma.role.upsert({ where: { name: 'SUPER_ADMIN' }, update: {}, create: { name: 'SUPER_ADMIN' } });
        await prisma.user.update({ where: { phone: admin.phone }, data: { roleId: role.id } });
        const login = await request(app).post('/api/v1/auth/login').send({ identifier: admin.phone, password: admin.password });
        adminToken = login.body.data.accessToken;

        const l1 = await request(app).post('/api/v1/locations').set(auth(adminToken))
            .send({ city: 'Test P3A City', area: 'Centre', state: 'West Bengal', pincode: '713216' });
        locId = l1.body.data.id;

        const l2 = await request(app).post('/api/v1/locations').set(auth(adminToken))
            .send({ city: 'Test P3A Off', area: 'Old', state: 'West Bengal', pincode: '713217' });
        inactiveLocId = l2.body.data.id;
        await request(app).patch(`/api/v1/locations/${inactiveLocId}/status`).set(auth(adminToken)).send({ isActive: false });
    });

    afterAll(async () => {
        await cleanup();
        await prisma.$disconnect();
    });

    it('create with locationId only (201), city/state/pincode copied from Location', async () => {
        const res = await request(app).post('/api/v1/pharmacies/admin-create').set(auth(adminToken)).send({ ...base, locationId: locId });
        expect(res.status).toBe(201);
        expect(res.body.data.locationId).toBe(locId);
        expect(res.body.data.city).toBe('Test P3A City');
        expect(res.body.data.state).toBe('West Bengal');
        expect(res.body.data.pincode).toBe('713216');
        linkedPharmacyId = res.body.data.id;
    });

    it('unknown locationId (404)', async () => {
        const res = await request(app).post('/api/v1/pharmacies/admin-create').set(auth(adminToken))
            .send({ ...base, locationId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d' });
        expect(res.status).toBe(404);
    });

    it('inactive location (400)', async () => {
        const res = await request(app).post('/api/v1/pharmacies/admin-create').set(auth(adminToken)).send({ ...base, locationId: inactiveLocId });
        expect(res.status).toBe(400);
    });

    it('no locationId and no city/state/pincode (400)', async () => {
        const res = await request(app).post('/api/v1/pharmacies/admin-create').set(auth(adminToken)).send(base);
        expect(res.status).toBe(400);
    });

    it('old way (city/state/pincode, no locationId) still works (201), locationId null', async () => {
        const res = await request(app).post('/api/v1/pharmacies/admin-create').set(auth(adminToken))
            .send({ ...base, name: 'Test P3A Old Way', city: 'Test P3A Town', state: 'West Bengal', pincode: '713216' });
        expect(res.status).toBe(201);
        expect(res.body.data.locationId).toBeNull();
    });

    it('pharmacy list shows the linked location object (200)', async () => {
        const res = await request(app).get('/api/v1/pharmacies').set(auth(adminToken));
        expect(res.status).toBe(200);
        const found = res.body.data.find((p: any) => p.id === linkedPharmacyId);
        expect(found).toBeDefined();
        expect(found.location.city).toBe('Test P3A City');
    });
});
