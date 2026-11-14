import request from 'supertest';
import app from '../../src/app';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
jest.setTimeout(30000);

describe('Establishment API Automated Tests', () => {
    let patientToken = "";
    let adminToken = "";
    let establishmentId1 = "";
    let establishmentId2 = "";

    const testPatient = { fullName: "Estab Patient User", phone: "3333333333", password: "Password123" };
    const testAdmin = { fullName: "Estab Admin User", phone: "4444444444", password: "Password123" };

    beforeAll(async () => {
        // Clean up purono test data
        await prisma.user.deleteMany({ where: { phone: { in: [testPatient.phone, testAdmin.phone] } } });

        // 1. Regular Patient toiri kora ar token neya
        await request(app).post('/api/v1/auth/register').send(testPatient);
        let res = await request(app).post('/api/v1/auth/login').send({ identifier: testPatient.phone, password: testPatient.password });
        patientToken = res.body.data.accessToken;

        // 2. Admin toiri kora ar tar role database theke update kora
        await request(app).post('/api/v1/auth/register').send(testAdmin);
        let superAdminRole = await prisma.role.findUnique({ where: { name: 'SUPER_ADMIN' } });
        if (!superAdminRole) {
            superAdminRole = await prisma.role.create({ data: { name: 'SUPER_ADMIN', description: 'System Administrator' } });
        }
        await prisma.user.update({
            where: { phone: testAdmin.phone },
            data: { roleId: superAdminRole.id }
        });

        // Admin er token neya
        res = await request(app).post('/api/v1/auth/login').send({ identifier: testAdmin.phone, password: testAdmin.password });
        adminToken = res.body.data.accessToken;
    });

    afterAll(async () => {
        // Data clean kora
        await prisma.establishment.deleteMany({ where: { phone: "9998887771" } });
        await prisma.establishment.deleteMany({ where: { phone: "9998887772" } });
        await prisma.user.deleteMany({ where: { phone: { in: [testPatient.phone, testAdmin.phone] } } });
        await prisma.$disconnect();
    });

    it('should deny a regular user from creating an establishment (403 Forbidden)', async () => {
        const res = await request(app)
            .post('/api/v1/establishments/admin-create')
            .set('Authorization', `Bearer ${patientToken}`)
            .send({
                name: "Hacker Clinic",
                phone: "0000000000",
                line1: "Nowhere",
                city: "Nowhere",
                state: "NW",
                pincode: "000000",
                services: ["CLINIC"]
            });
        
        expect(res.status).toBe(403);
        expect(res.body.success).toBe(false);
    });

    it('should allow Super Admin to create a Primary Establishment with both Clinic and Pharmacy', async () => {
        const res = await request(app)
            .post('/api/v1/establishments/admin-create')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                name: "Test Primary Branch",
                phone: "9998887771",
                line1: "Test Area",
                city: "Test City",
                state: "WB",
                pincode: "700001",
                services: ["CLINIC", "PHARMACY"],
                isPrimaryPharmacy: true
            });
        
        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.isPrimaryPharmacy).toBe(true);
        expect(res.body.data.services.length).toBe(2);
        
        establishmentId1 = res.body.data.id;
    });

    it('should allow Super Admin to create a second establishment (Non-Primary)', async () => {
        const res = await request(app)
            .post('/api/v1/establishments/admin-create')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                name: "Test Secondary Branch",
                phone: "9998887772",
                line1: "Test Area 2",
                city: "Test City",
                state: "WB",
                pincode: "700002",
                services: ["PHARMACY"]
            });
        
        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.isPrimaryPharmacy).toBe(false);
        expect(res.body.data.services.length).toBe(1);

        establishmentId2 = res.body.data.id;
    });

    it('should allow Super Admin to change the Primary Pharmacy', async () => {
        // Secondary take primary kora hocche
        const res = await request(app)
            .put(`/api/v1/establishments/admin-primary/${establishmentId2}`)
            .set('Authorization', `Bearer ${adminToken}`);
        
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.isPrimaryPharmacy).toBe(true);

        // Fetch kore dekhi purono ta auto false hoyeche kina
        const fetchRes = await request(app)
            .get('/api/v1/establishments')
            .set('Authorization', `Bearer ${patientToken}`); // Patient o list dekhte pare
        
        const firstEstab = fetchRes.body.data.find((e: any) => e.id === establishmentId1);
        const secondEstab = fetchRes.body.data.find((e: any) => e.id === establishmentId2);

        expect(secondEstab.isPrimaryPharmacy).toBe(true);
        expect(firstEstab.isPrimaryPharmacy).toBe(false); // Old primary should be false
    });
});