import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/config/prisma';

jest.setTimeout(30000);

describe('Location API', () => {
    let adminToken = '';
    let patientToken = '';
    let locId = '';
    const admin = { fullName: 'Loc Admin', phone: '5555555551', password: 'Password123' };
    const patient = { fullName: 'Loc Patient', phone: '5555555552', password: 'Password123' };
    const body = { city: 'Test Durgapur', area: 'City Centre', state: 'West Bengal', pincode: '713216', latitude: 23.5204, longitude: 87.3119 };

    const cleanup = async () => {
        await prisma.location.deleteMany({ where: { city: { startsWith: 'Test ' } } });
        await prisma.user.deleteMany({ where: { phone: { in: [admin.phone, patient.phone] } } });
    };

    beforeAll(async () => {
        await cleanup();
        await request(app).post('/api/v1/auth/register').send(patient);
        let res = await request(app).post('/api/v1/auth/login').send({ identifier: patient.phone, password: patient.password });
        patientToken = res.body.data.accessToken;

        await request(app).post('/api/v1/auth/register').send(admin);
        const role = await prisma.role.upsert({ where: { name: 'SUPER_ADMIN' }, update: {}, create: { name: 'SUPER_ADMIN' } });
        await prisma.user.update({ where: { phone: admin.phone }, data: { roleId: role.id } });
        res = await request(app).post('/api/v1/auth/login').send({ identifier: admin.phone, password: admin.password });
        adminToken = res.body.data.accessToken;
    });

    afterAll(async () => {
        await cleanup();
        await prisma.$disconnect();
    });

    it('denies a Patient from creating a location (403)', async () => {
        const res = await request(app).post('/api/v1/locations').set('Authorization', `Bearer ${patientToken}`).send(body);
        expect(res.status).toBe(403);
    });

    it('denies unauthenticated create (401)', async () => {
        const res = await request(app).post('/api/v1/locations').send(body);
        expect(res.status).toBe(401);
    });

    it('rejects invalid PIN (400)', async () => {
        const res = await request(app).post('/api/v1/locations').set('Authorization', `Bearer ${adminToken}`).send({ ...body, pincode: '12' });
        expect(res.status).toBe(400);
    });

    it('rejects latitude without longitude (400)', async () => {
        const { longitude, ...rest } = body;
        const res = await request(app).post('/api/v1/locations').set('Authorization', `Bearer ${adminToken}`).send(rest);
        expect(res.status).toBe(400);
    });

    it('Super Admin creates a location (201)', async () => {
        const res = await request(app).post('/api/v1/locations').set('Authorization', `Bearer ${adminToken}`).send(body);
        expect(res.status).toBe(201);
        expect(res.body.data.isActive).toBe(true);
        locId = res.body.data.id;
    });

    it('blocks duplicate city+area+PIN, case-insensitive (409)', async () => {
        const res = await request(app).post('/api/v1/locations').set('Authorization', `Bearer ${adminToken}`)
            .send({ ...body, city: 'test durgapur', area: 'city centre' });
        expect(res.status).toBe(409);
    });

    it('writes an audit log for creation', async () => {
        const log = await prisma.auditLog.findFirst({ where: { entityType: 'Location', entityId: locId, action: 'LOCATION_CREATED' } });
        expect(log).not.toBeNull();
    });

    it('Super Admin updates a location (200)', async () => {
        const res = await request(app).put(`/api/v1/locations/${locId}`).set('Authorization', `Bearer ${adminToken}`).send({ landmarkIgnored: 'x', area: 'Bidhannagar' });
        expect(res.status).toBe(200);
        expect(res.body.data.area).toBe('Bidhannagar');
    });

    it('public list shows active location without login (200)', async () => {
        const res = await request(app).get('/api/v1/locations?city=Test Durgapur');
        expect(res.status).toBe(200);
        expect(res.body.data.items.some((l: any) => l.id === locId)).toBe(true);
    });

    it('deactivated location disappears from public list and public get', async () => {
        const off = await request(app).patch(`/api/v1/locations/${locId}/status`).set('Authorization', `Bearer ${adminToken}`).send({ isActive: false });
        expect(off.status).toBe(200);

        const list = await request(app).get('/api/v1/locations?city=Test Durgapur');
        expect(list.body.data.items.some((l: any) => l.id === locId)).toBe(false);

        const one = await request(app).get(`/api/v1/locations/${locId}`);
        expect(one.status).toBe(404);
    });

    it('Super Admin still sees inactive location in admin list', async () => {
        const res = await request(app).get('/api/v1/locations/admin/all?isActive=false').set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.data.items.some((l: any) => l.id === locId)).toBe(true);
    });

    it('Patient cannot use admin list (403)', async () => {
        const res = await request(app).get('/api/v1/locations/admin/all').set('Authorization', `Bearer ${patientToken}`);
        expect(res.status).toBe(403);
    });
});
