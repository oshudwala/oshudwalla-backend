import request from 'supertest';
import app from '../../src/app';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
jest.setTimeout(30000);

describe('Admin API Automated Tests', () => {
    let patientToken = "";
    let adminToken = "";
    let testPatientId = "";

    const testPatient = { fullName: "Patient User", phone: "1111111111", password: "Password123" };
    const testAdmin = { fullName: "Admin User", phone: "2222222222", password: "Password123" };

    beforeAll(async () => {
        // Clean up purono test data
        await prisma.user.deleteMany({ where: { phone: { in: [testPatient.phone, testAdmin.phone] } } });

        // 1. Regular Patient toiri kora ar token neya
        await request(app).post('/api/v1/auth/register').send(testPatient);
        let res = await request(app).post('/api/v1/auth/login').send({ identifier: testPatient.phone, password: testPatient.password });
        patientToken = res.body.data.accessToken;
        testPatientId = res.body.data.user.id;

        // 2. Admin toiri kora ar tar role database theke update kora (Script er moto)
        await request(app).post('/api/v1/auth/register').send(testAdmin);
        
        let superAdminRole = await prisma.role.findUnique({ where: { name: 'SUPER_ADMIN' } });
        if (!superAdminRole) {
            superAdminRole = await prisma.role.create({ data: { name: 'SUPER_ADMIN', description: 'System Administrator' } });
        }

        await prisma.user.update({
            where: { phone: testAdmin.phone },
            data: { roleId: superAdminRole.id }
        });

        // Admin er notun token neya
        res = await request(app).post('/api/v1/auth/login').send({ identifier: testAdmin.phone, password: testAdmin.password });
        adminToken = res.body.data.accessToken;
    });

    afterAll(async () => {
        // Test data clean kora
        await prisma.platformSetting.deleteMany({ where: { key: "TEST_SETTING" } });
        await prisma.user.deleteMany({ where: { phone: { in: [testPatient.phone, testAdmin.phone] } } });
        await prisma.$disconnect();
    });

    it('should deny access to non-admin users (403 Forbidden)', async () => {
        const res = await request(app)
            .get('/api/v1/admin/users')
            .set('Authorization', `Bearer ${patientToken}`); // Patient token pathacchi
        
        expect(res.status).toBe(403);
        expect(res.body.success).toBe(false);
    });

    it('should fetch user list for Super Admin', async () => {
        const res = await request(app)
            .get('/api/v1/admin/users')
            .set('Authorization', `Bearer ${adminToken}`); // Admin token pathacchi
        
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('should allow Super Admin to update user role to RIDER', async () => {
        const res = await request(app)
            .put(`/api/v1/admin/users/${testPatientId}/access`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ roleName: 'RIDER' });
        
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.role.name).toBe('RIDER');
    });

    it('should allow Super Admin to update platform settings', async () => {
        const res = await request(app)
            .post('/api/v1/admin/settings')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                key: "TEST_SETTING",
                value: { isEnabled: true, limit: 100 }
            });
        
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.value.limit).toBe(100);
    });
});