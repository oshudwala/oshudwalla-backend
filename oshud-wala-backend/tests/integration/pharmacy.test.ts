import request from 'supertest';
import app from '../../src/app';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
jest.setTimeout(30000);

describe('Pharmacy API Automated Tests', () => {
    let patientToken = "";
    let adminToken = "";
    let pharmacyId1 = "";
    let pharmacyId2 = "";

    const testPatient = { fullName: "Pharmacy Test Patient", phone: "3333333333", password: "Password123" };
    const testAdmin = { fullName: "Pharmacy Test Admin", phone: "4444444444", password: "Password123" };

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
        await prisma.pharmacy.deleteMany({ where: { phone: "9998887771" } });
        await prisma.pharmacy.deleteMany({ where: { phone: "9998887772" } });
        await prisma.user.deleteMany({ where: { phone: { in: [testPatient.phone, testAdmin.phone] } } });
        await prisma.$disconnect();
    });

    it('should deny a regular user from creating a pharmacy (403 Forbidden)', async () => {
        const res = await request(app)
            .post('/api/v1/pharmacies/admin-create')
            .set('Authorization', `Bearer ${patientToken}`)
            .send({
                name: "Hacker Clinic",
                phone: "0000000000",
                line1: "Nowhere",
                city: "Nowhere",
                state: "NW",
                pincode: "000000"
            });
        
        expect(res.status).toBe(403);
        expect(res.body.success).toBe(false);
    });

    it('should allow Super Admin to create a Primary Pharmacy', async () => {
        const res = await request(app)
            .post('/api/v1/pharmacies/admin-create')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                name: "Test Primary Branch",
                phone: "9998887771",
                line1: "Test Area",
                city: "Test City",
                state: "WB",
                pincode: "700001",
                isPrimary: true
            });
        
        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.isPrimary).toBe(true);
        
        pharmacyId1 = res.body.data.id;
    });

    it('should allow Super Admin to create a second pharmacy (Non-Primary)', async () => {
        const res = await request(app)
            .post('/api/v1/pharmacies/admin-create')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                name: "Test Secondary Branch",
                phone: "9998887772",
                line1: "Test Area 2",
                city: "Test City",
                state: "WB",
                pincode: "700002",
                isPrimary: false
            });
        
        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.isPrimary).toBe(false);

        pharmacyId2 = res.body.data.id;
    });

    it('should allow Super Admin to change the Primary Pharmacy', async () => {
        // Secondary take primary kora hocche
        const res = await request(app)
            .put(`/api/v1/pharmacies/admin-primary/${pharmacyId2}`)
            .set('Authorization', `Bearer ${adminToken}`);
        
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.isPrimary).toBe(true);

        // Fetch kore dekhi purono ta auto false hoyeche kina
        const fetchRes = await request(app)
            .get('/api/v1/pharmacies')
            .set('Authorization', `Bearer ${patientToken}`); // Patient o list dekhte pare
        
        const firstPharmacy = fetchRes.body.data.find((e: any) => e.id === pharmacyId1);
        const secondPharmacy = fetchRes.body.data.find((e: any) => e.id === pharmacyId2);

        expect(secondPharmacy.isPrimary).toBe(true);
        expect(firstPharmacy.isPrimary).toBe(false); // Old primary should be false
    });
});
describe('Doctor onboarding access (Step 1 security fix)', () => {
    let patientToken = '';
    const patient = { fullName: 'Doctor Route Patient', phone: '3333333334', password: 'Password123' };

    beforeAll(async () => {
        await prisma.user.deleteMany({ where: { phone: patient.phone } });
        await request(app).post('/api/v1/auth/register').send(patient);
        const res = await request(app).post('/api/v1/auth/login').send({ identifier: patient.phone, password: patient.password });
        patientToken = res.body.data.accessToken;
    });

    afterAll(async () => {
        await prisma.user.deleteMany({ where: { phone: patient.phone } });
    });

    it('should deny a Patient from onboarding a doctor (403)', async () => {
        const res = await request(app)
            .post('/api/v1/doctors/onboard')
            .set('Authorization', `Bearer ${patientToken}`)
            .send({});
        expect(res.status).toBe(403);
    });
});
