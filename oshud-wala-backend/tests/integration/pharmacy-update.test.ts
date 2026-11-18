import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/config/prisma';

jest.setTimeout(150000);

describe('Step 3B-2: Pharmacy profile update', () => {
    const admin = { fullName: 'P3B2 Admin', phone: '5555555621', password: 'Password123' };
    const patient = { fullName: 'P3B2 Patient', phone: '5555555622', password: 'Password123' };
    const fakeId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
    const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
    const login = async (identifier: string, password: string) =>
        (await request(app).post('/api/v1/auth/login').send({ identifier, password })).body.data.accessToken as string;

    let adminToken = '', patientToken = '', owner1Token = '', owner2Token = '', locId = '';
    let ph1: any = null, ph2: any = null;
    let n = 0;

    const body = () => {
        n++;
        return {
            name: `Test P3B2 Pharmacy ${n}`,
            ownerName: 'Test P3B2 Owner',
            ownerEmail: `p3b2.owner${n}@example.com`,
            ownerPassword: 'Password123',
            phone: `55555568${String(n).padStart(2, '0')}`,
            locationId: locId,
            line1: 'Main Road',
        };
    };
    const put = (id: string, token: string, b: any) => request(app).put(`/api/v1/pharmacies/${id}`).set(auth(token)).send(b);

    const cleanup = async () => {
        await prisma.pharmacy.deleteMany({ where: { name: { startsWith: 'Test P3B2' } } });
        await prisma.location.deleteMany({ where: { city: { startsWith: 'Test P3B2' } } });
        const users = await prisma.user.findMany({
            where: { OR: [{ phone: { in: [admin.phone, patient.phone] } }, { phone: { startsWith: '55555568' } }, { email: { startsWith: 'p3b2.' } }] },
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
        adminToken = await login(admin.phone, admin.password);
        patientToken = await login(patient.phone, patient.password);

        const loc = await request(app).post('/api/v1/locations').set(auth(adminToken))
            .send({ city: 'Test P3B2 City', area: 'Centre', state: 'West Bengal', pincode: '713216' });
        locId = loc.body.data.id;

        const b1 = body();
        const b2 = body();
        ph1 = (await request(app).post('/api/v1/pharmacies/admin-create').set(auth(adminToken)).send(b1)).body.data;
        ph2 = (await request(app).post('/api/v1/pharmacies/admin-create').set(auth(adminToken)).send(b2)).body.data;
        owner1Token = await login(b1.ownerEmail, b1.ownerPassword);
        owner2Token = await login(b2.ownerEmail, b2.ownerPassword);
    });

    afterAll(async () => {
        await cleanup();
        await prisma.$disconnect();
    });

    it('1. Super Admin updates any pharmacy (200)', async () => {
        const res = await put(ph1.id, adminToken, { line1: 'Admin Road' });
        expect(res.status).toBe(200);
        expect(res.body.data.line1).toBe('Admin Road');
    });

    it('2. owner updates own pharmacy names (200), saved in database', async () => {
        const res = await put(ph1.id, owner1Token, { name: 'Test P3B2 Renamed', nameBn: 'নতুন নাম', nameHi: 'नया नाम' });
        expect(res.status).toBe(200);
        const row = await prisma.pharmacy.findUnique({ where: { id: ph1.id } });
        expect(row?.name).toBe('Test P3B2 Renamed');
        expect(row?.nameBn).toBe('নতুন নাম');
        expect(row?.nameHi).toBe('नया नाम');
    });

    it('3. owner sets map pin latitude + longitude (200)', async () => {
        const res = await put(ph1.id, owner1Token, { latitude: 23.5204, longitude: 87.3119 });
        expect(res.status).toBe(200);
        expect(Number(res.body.data.latitude)).toBeCloseTo(23.5204, 4);
        expect(Number(res.body.data.longitude)).toBeCloseTo(87.3119, 4);
    });

    it('4. owner clears the map pin with null + null (200)', async () => {
        const res = await put(ph1.id, owner1Token, { latitude: null, longitude: null });
        expect(res.status).toBe(200);
        expect(res.body.data.latitude).toBeNull();
        expect(res.body.data.longitude).toBeNull();
    });

    it('5. latitude without longitude (400)', async () => {
        const res = await put(ph1.id, owner1Token, { latitude: 22.5 });
        expect(res.status).toBe(400);
    });

    it('6. owner cannot edit another pharmacy (403)', async () => {
        const res = await put(ph2.id, owner1Token, { line1: 'Hacked Road' });
        expect(res.status).toBe(403);
        const row = await prisma.pharmacy.findUnique({ where: { id: ph2.id } });
        expect(row?.line1).toBe('Main Road');
    });

    it('7. Patient cannot update a pharmacy (403)', async () => {
        const res = await put(ph1.id, patientToken, { line1: 'Patient Road' });
        expect(res.status).toBe(403);
    });

    it('8. no token (401)', async () => {
        const res = await request(app).put(`/api/v1/pharmacies/${ph1.id}`).send({ line1: 'No Token Road' });
        expect(res.status).toBe(401);
    });

    it('9. unknown pharmacy (404)', async () => {
        const res = await put(fakeId, adminToken, { line1: 'Nowhere Road' });
        expect(res.status).toBe(404);
    });

    it('10. invalid pharmacy id (400)', async () => {
        const res = await put('abc', adminToken, { line1: 'Bad Id Road' });
        expect(res.status).toBe(400);
    });

    it('11. empty body (400)', async () => {
        const res = await put(ph1.id, owner1Token, {});
        expect(res.status).toBe(400);
    });

    it('12. extra fields are ignored: status, isPrimary, city, locationId do not change', async () => {
        const before = await prisma.pharmacy.findUnique({ where: { id: ph2.id } });
        const res = await put(ph2.id, owner2Token, { line1: 'Safe Road', status: 'SUSPENDED', isPrimary: true, city: 'Hack City', locationId: fakeId });
        expect(res.status).toBe(200);
        const after = await prisma.pharmacy.findUnique({ where: { id: ph2.id } });
        expect(after?.line1).toBe('Safe Road');
        expect(after?.status).toBe('ACTIVE');
        expect(after?.isPrimary).toBe(false);
        expect(after?.city).toBe(before?.city);
        expect(after?.locationId).toBe(before?.locationId);
    });

    it('13. one-letter name (400)', async () => {
        const res = await put(ph1.id, owner1Token, { name: 'a' });
        expect(res.status).toBe(400);
    });

    it('14. audit log has PHARMACY_UPDATED', async () => {
        const log = await prisma.auditLog.findFirst({ where: { entityType: 'Pharmacy', entityId: ph1.id, action: 'PHARMACY_UPDATED' } });
        expect(log).not.toBeNull();
    });
});
