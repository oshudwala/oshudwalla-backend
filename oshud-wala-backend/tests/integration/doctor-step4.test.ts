import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/config/prisma';

jest.setTimeout(180000);

describe('Step 4: Doctor global profile + PharmacyDoctor assignment', () => {
    const adminPhone = '5555555681';
    const patientPhone = '5555555682';
    const owner1Phone = '5555557601';
    const owner2Phone = '5555557602';
    const docPhone = '5555557611';
    const owner1Email = 's4.owner1@test.com';
    const owner2Email = 's4.owner2@test.com';
    const docEmail = 's4.doctor@test.com';
    const regNo = 'TEST-REG-S4-001';
    const specName = 'Test Spec Step4';
    const password = 'Password123!';

    let adminToken = '';
    let patientToken = '';
    let owner1Token = '';
    let ph1Id = '';
    let ph2Id = '';
    let specId = '';
    let doctorId = '';
    let assignmentId = '';

    const cleanup = async () => {
        const docs = await prisma.doctor.findMany({ where: { registrationNumber: regNo }, select: { id: true } });
        const docIds = docs.map((d) => d.id);
        if (docIds.length > 0) {
            const assigns = await prisma.pharmacyDoctor.findMany({ where: { doctorId: { in: docIds } }, select: { id: true } });
            await prisma.auditLog.deleteMany({ where: { entityId: { in: [...docIds, ...assigns.map((a) => a.id)] } } });
            await prisma.pharmacyDoctor.deleteMany({ where: { doctorId: { in: docIds } } });
            await prisma.doctorSpecialization.deleteMany({ where: { doctorId: { in: docIds } } });
            await prisma.doctor.deleteMany({ where: { id: { in: docIds } } });
        }
        const pharmacies = await prisma.pharmacy.findMany({ where: { phone: { in: [owner1Phone, owner2Phone] } }, select: { id: true } });
        const phIds = pharmacies.map((p) => p.id);
        if (phIds.length > 0) {
            await prisma.auditLog.deleteMany({ where: { entityId: { in: phIds } } });
            await prisma.pharmacyStaff.deleteMany({ where: { pharmacyId: { in: phIds } } });
            await prisma.pharmacy.deleteMany({ where: { id: { in: phIds } } });
        }
        await prisma.specialization.deleteMany({ where: { name: specName } });
        await prisma.user.deleteMany({
            where: {
                OR: [
                    { phone: { in: [adminPhone, patientPhone, owner1Phone, owner2Phone] } },
                    { email: { in: [owner1Email, owner2Email] } },
                ],
            },
        });
        await prisma.location.deleteMany({ where: { city: 'Test CityS4' } });
    };

    beforeAll(async () => {
        await cleanup();

        await request(app).post('/api/v1/auth/register').send({ fullName: 'Test S4 Admin', phone: adminPhone, password });
        const superAdminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'SUPER_ADMIN' } });
        await prisma.user.update({ where: { phone: adminPhone }, data: { roleId: superAdminRole.id } });
        adminToken = (await request(app).post('/api/v1/auth/login').send({ identifier: adminPhone, password })).body.data.accessToken;

        await request(app).post('/api/v1/auth/register').send({ fullName: 'Test S4 Patient', phone: patientPhone, password });
        patientToken = (await request(app).post('/api/v1/auth/login').send({ identifier: patientPhone, password })).body.data.accessToken;

        const spec = await prisma.specialization.create({ data: { name: specName, description: 'Cardio' } });
        specId = spec.id;

        const loc = await prisma.location.create({
            data: { city: 'Test CityS4', area: 'Med', state: 'WB', pincode: '713350', uniqueKey: 'test-citys4-med-713350', isActive: true },
        });

        const res1 = await request(app)
            .post('/api/v1/pharmacies/admin-create')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                name: 'Test S4 Shop1',
                ownerName: 'Test S4 Owner1',
                ownerEmail: owner1Email,
                ownerPassword: password,
                phone: owner1Phone,
                locationId: loc.id,
                line1: 'Road 1',
            });
        ph1Id = res1.body.data.id;
        owner1Token = (await request(app).post('/api/v1/auth/login').send({ identifier: owner1Phone, password })).body.data.accessToken;

        const res2 = await request(app)
            .post('/api/v1/pharmacies/admin-create')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                name: 'Test S4 Shop2',
                ownerName: 'Test S4 Owner2',
                ownerEmail: owner2Email,
                ownerPassword: password,
                phone: owner2Phone,
                locationId: loc.id,
                line1: 'Road 2',
            });
        ph2Id = res2.body.data.id;
    });

    afterAll(async () => {
        await cleanup();
    });

    it('1. Super Admin creates a global Doctor profile (201)', async () => {
        const res = await request(app)
            .post('/api/v1/doctors')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                fullName: 'Dr. Test Step4',
                phone: docPhone,
                email: docEmail,
                registrationNumber: regNo,
                qualifications: 'MBBS, MD',
                experienceYears: 8,
                languages: ['Bengali', 'English'],
                specializationIds: [specId],
            });
        expect(res.status).toBe(201);
        expect(res.body.data.fullName).toBe('Dr. Test Step4');
        expect(res.body.data.specializations).toHaveLength(1);
        doctorId = res.body.data.id;
    });

    it('2. Duplicate registrationNumber returns 409', async () => {
        const res = await request(app)
            .post('/api/v1/doctors')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                fullName: 'Dr. Dup',
                phone: '5555557699',
                registrationNumber: regNo,
                specializationIds: [specId],
            });
        expect(res.status).toBe(409);
    });

    it('3. Pharmacy owner cannot create a global Doctor profile (403)', async () => {
        const res = await request(app)
            .post('/api/v1/doctors')
            .set('Authorization', `Bearer ${owner1Token}`)
            .send({
                fullName: 'Dr. Unauth',
                phone: '5555557698',
                registrationNumber: 'UNAUTH-001',
                specializationIds: [specId],
            });
        expect(res.status).toBe(403);
    });

    it('4. Super Admin updates global Doctor profile and verifies doctor (200)', async () => {
        const res = await request(app)
            .put(`/api/v1/doctors/${doctorId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ experienceYears: 10, isVerified: true });
        expect(res.status).toBe(200);
        expect(res.body.data.experienceYears).toBe(10);
        expect(res.body.data.isVerified).toBe(true);
    });

    it('5. Owner assigns global Doctor to own pharmacy (200)', async () => {
        const res = await request(app)
            .post('/api/v1/doctors/assign')
            .set('Authorization', `Bearer ${owner1Token}`)
            .send({ pharmacyId: ph1Id, doctorId, consultationFeePaise: 50000 });
        expect(res.status).toBe(200);
        expect(res.body.data.consultationFeePaise).toBe(50000);
        assignmentId = res.body.data.id;
    });

    it('6. Owner cannot assign Doctor to another pharmacy (403)', async () => {
        const res = await request(app)
            .post('/api/v1/doctors/assign')
            .set('Authorization', `Bearer ${owner1Token}`)
            .send({ pharmacyId: ph2Id, doctorId, consultationFeePaise: 60000 });
        expect(res.status).toBe(403);
    });

    it('7. Super Admin assigns same Doctor to second pharmacy (multi-pharmacy) (200)', async () => {
        const res = await request(app)
            .post('/api/v1/doctors/assign')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ pharmacyId: ph2Id, doctorId, consultationFeePaise: 70000 });
        expect(res.status).toBe(200);
        expect(res.body.data.consultationFeePaise).toBe(70000);
    });

    it('8. Patient searches global doctors and views single doctor with both pharmacies (200)', async () => {
        const listRes = await request(app)
            .get(`/api/v1/doctors?q=Step4&specializationId=${specId}`)
            .set('Authorization', `Bearer ${patientToken}`);
        expect(listRes.status).toBe(200);
        expect(listRes.body.data.some((d: any) => d.id === doctorId)).toBe(true);

        const singleRes = await request(app)
            .get(`/api/v1/doctors/${doctorId}`)
            .set('Authorization', `Bearer ${patientToken}`);
        expect(singleRes.status).toBe(200);
        expect(singleRes.body.data.pharmacies).toHaveLength(2);
    });

    it('9. Owner deactivates and reactivates doctor assignment for own pharmacy (200)', async () => {
        const off = await request(app)
            .patch(`/api/v1/doctors/assign/${assignmentId}/status`)
            .set('Authorization', `Bearer ${owner1Token}`)
            .send({ isActive: false });
        expect(off.status).toBe(200);
        expect(off.body.data.isActive).toBe(false);

        const on = await request(app)
            .patch(`/api/v1/doctors/assign/${assignmentId}/status`)
            .set('Authorization', `Bearer ${owner1Token}`)
            .send({ isActive: true });
        expect(on.status).toBe(200);
        expect(on.body.data.isActive).toBe(true);
    });

    it('10. Patient cannot assign doctor (403)', async () => {
        const res = await request(app)
            .post('/api/v1/doctors/assign')
            .set('Authorization', `Bearer ${patientToken}`)
            .send({ pharmacyId: ph1Id, doctorId, consultationFeePaise: 50000 });
        expect(res.status).toBe(403);
    });

    it('11. Audit logs have DOCTOR_CREATED, DOCTOR_UPDATED, DOCTOR_ASSIGNED_TO_PHARMACY, DOCTOR_ASSIGNMENT_STATUS_UPDATED', async () => {
        const logs = await prisma.auditLog.findMany({
            where: { entityId: { in: [doctorId, assignmentId] } },
            select: { action: true },
        });
        const actions = logs.map((l) => l.action);
        expect(actions).toContain('DOCTOR_CREATED');
        expect(actions).toContain('DOCTOR_UPDATED');
        expect(actions).toContain('DOCTOR_ASSIGNED_TO_PHARMACY');
        expect(actions).toContain('DOCTOR_ASSIGNMENT_STATUS_UPDATED');
    });
});
