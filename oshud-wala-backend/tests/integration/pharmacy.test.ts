import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/config/prisma';

jest.setTimeout(120000);

describe('Pharmacy API Automated Tests', () => {
    const admin = { fullName: 'PHM Admin', phone: '5555557001', password: 'Password123' };
    const patient = { fullName: 'PHM Patient', phone: '5555557002', password: 'Password123' };
    const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

    let adminToken = '', patientToken = '', locId = '';
    let firstId = '', secondId = '';
    let prevPrimaryId: string | null = null;
    let n = 0;

    const body = (over: any = {}) => {
        n++;
        return {
            name: `Test PHM Pharmacy ${n}`,
            ownerName: 'Test PHM Owner',
            ownerEmail: `phm.owner${n}@example.com`,
            ownerPassword: 'Password123',
            phone: `55555571${String(n).padStart(2, '0')}`,
            locationId: locId,
            line1: 'Main Road',
            ...over,
        };
    };

    const cleanup = async () => {
        await prisma.pharmacy.deleteMany({ where: { name: { startsWith: 'Test PHM' } } });
        await prisma.location.deleteMany({ where: { city: { startsWith: 'Test PHM' } } });
        const users = await prisma.user.findMany({
            where: { OR: [{ phone: { in: [admin.phone, patient.phone] } }, { phone: { startsWith: '55555571' } }, { email: { startsWith: 'phm.' } }] },
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
        // remember the real Primary pharmacy so we can put it back after the tests
        const prev = await prisma.pharmacy.findFirst({ where: { isPrimary: true, NOT: { name: { startsWith: 'Test PHM' } } } });
        prevPrimaryId = prev ? prev.id : null;

        await request(app).post('/api/v1/auth/register').send(admin);
        await request(app).post('/api/v1/auth/register').send(patient);
        const role = await prisma.role.upsert({ where: { name: 'SUPER_ADMIN' }, update: {}, create: { name: 'SUPER_ADMIN' } });
        await prisma.user.update({ where: { phone: admin.phone }, data: { roleId: role.id } });
        let res = await request(app).post('/api/v1/auth/login').send({ identifier: admin.phone, password: admin.password });
        adminToken = res.body.data.accessToken;
        res = await request(app).post('/api/v1/auth/login').send({ identifier: patient.phone, password: patient.password });
        patientToken = res.body.data.accessToken;

        const loc = await request(app).post('/api/v1/locations').set(auth(adminToken))
            .send({ city: 'Test PHM City', area: 'Centre', state: 'West Bengal', pincode: '713216' });
        locId = loc.body.data.id;
    });

    afterAll(async () => {
        await cleanup();
        if (prevPrimaryId) {
            await prisma.pharmacy.updateMany({ where: { id: prevPrimaryId }, data: { isPrimary: true } });
        }
        await prisma.$disconnect();
    });

    it('should deny a regular user from creating a pharmacy (403 Forbidden)', async () => {
        const res = await request(app).post('/api/v1/pharmacies/admin-create').set(auth(patientToken)).send(body());
        expect(res.status).toBe(403);
    });

    it('should allow Super Admin to create a Primary Pharmacy', async () => {
        const res = await request(app).post('/api/v1/pharmacies/admin-create').set(auth(adminToken)).send(body({ isPrimary: true }));
        expect(res.status).toBe(201);
        expect(res.body.data.isPrimary).toBe(true);
        firstId = res.body.data.id;
    });

    it('should allow Super Admin to create a second pharmacy (Non-Primary)', async () => {
        const res = await request(app).post('/api/v1/pharmacies/admin-create').set(auth(adminToken)).send(body());
        expect(res.status).toBe(201);
        expect(res.body.data.isPrimary).toBe(false);
        secondId = res.body.data.id;
    });

    it('should allow Super Admin to change the Primary Pharmacy', async () => {
        const res = await request(app).put(`/api/v1/pharmacies/admin-primary/${secondId}`).set(auth(adminToken));
        expect(res.status).toBe(200);
        expect(res.body.data.isPrimary).toBe(true);
        const old = await prisma.pharmacy.findUnique({ where: { id: firstId } });
        expect(old?.isPrimary).toBe(false);
    });

    it('should deny a Patient from onboarding a doctor (403)', async () => {
        const res = await request(app).post('/api/v1/doctors/onboard').set(auth(patientToken)).send({});
        expect(res.status).toBe(403);
    });
});
