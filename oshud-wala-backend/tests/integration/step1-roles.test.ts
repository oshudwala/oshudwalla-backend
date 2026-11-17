import request from 'supertest';
import { RoleName } from '@prisma/client';
import app from '../../src/app';
import { prisma } from '../../src/config/prisma';

jest.setTimeout(60000);

describe('Step 1: roles and security', () => {
    const admin = { fullName: 'S1 Admin', phone: '5555555571', password: 'Password123' };
    const patient = { fullName: 'S1 Patient', phone: '5555555572', password: 'Password123' };
    const owner = { fullName: 'S1 Owner', phone: '5555555573', password: 'Password123' };
    const phones = [admin.phone, patient.phone, owner.phone];
    let adminToken = '';
    let patientToken = '';
    let ownerId = '';
    const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

    const cleanup = async () => {
        const users = await prisma.user.findMany({ where: { phone: { in: phones } }, select: { id: true } });
        const ids = users.map((u) => u.id);
        if (ids.length) {
            try { await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } }); } catch {}
            await prisma.user.deleteMany({ where: { id: { in: ids } } });
        }
    };

    beforeAll(async () => {
        await cleanup();
        for (const u of [patient, owner, admin]) await request(app).post('/api/v1/auth/register').send(u);
        const role = await prisma.role.upsert({ where: { name: 'SUPER_ADMIN' }, update: {}, create: { name: 'SUPER_ADMIN' } });
        await prisma.user.update({ where: { phone: admin.phone }, data: { roleId: role.id } });
        let res = await request(app).post('/api/v1/auth/login').send({ identifier: admin.phone, password: admin.password });
        adminToken = res.body.data.accessToken;
        res = await request(app).post('/api/v1/auth/login').send({ identifier: patient.phone, password: patient.password });
        patientToken = res.body.data.accessToken;
        ownerId = (await prisma.user.findUniqueOrThrow({ where: { phone: owner.phone } })).id;
    });

    afterAll(async () => {
        await cleanup();
        await prisma.$disconnect();
    });

    it('admin and patient can login (token)', () => {
        expect(adminToken).toBeTruthy();
        expect(patientToken).toBeTruthy();
    });

    it('only 6 roles in enum', () => {
        const roles = Object.values(RoleName) as string[];
        expect(roles).toHaveLength(6);
        expect(roles).not.toContain('PHARMACY_ADMIN');
        expect(roles).not.toContain('PHARMACIST');
    });

    it('Super Admin lists users (200)', async () => {
        const res = await request(app).get('/api/v1/admin/users').set(auth(adminToken));
        expect(res.status).toBe(200);
    });

    it('role PHARMACIST rejected (400)', async () => {
        const res = await request(app).put(`/api/v1/admin/users/${ownerId}/access`).set(auth(adminToken)).send({ roleName: 'PHARMACIST' });
        expect(res.status).toBe(400);
    });

    it('role PHARMACY accepted (200)', async () => {
        const res = await request(app).put(`/api/v1/admin/users/${ownerId}/access`).set(auth(adminToken)).send({ roleName: 'PHARMACY' });
        expect(res.status).toBe(200);
    });

    it('Patient cannot onboard doctor (403)', async () => {
        const res = await request(app).post('/api/v1/doctors/onboard').set(auth(patientToken)).send({});
        expect(res.status).toBe(403);
    });

    it('Patient cannot create pharmacy (403)', async () => {
        const res = await request(app).post('/api/v1/pharmacies/admin-create').set(auth(patientToken)).send({});
        expect(res.status).toBe(403);
    });

    it('unknown pharmacy id on admin-primary (404)', async () => {
        const res = await request(app).put('/api/v1/pharmacies/admin-primary/00000000-0000-0000-0000-000000000000').set(auth(adminToken));
        expect(res.status).toBe(404);
    });
});
