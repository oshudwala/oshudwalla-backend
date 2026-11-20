import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/config/prisma';

jest.setTimeout(180000);

describe('Step 3G: Pharmacy Receptionist management', () => {
    const adminPhone = '5555555671';
    const patientPhone = '5555555672';
    const owner1Phone = '5555557501';
    const owner2Phone = '5555557502';
    const recep1Phone = '5555557511';
    const recep2Phone = '5555557512';
    const owner1Email = 'p3g.owner1@test.com';
    const owner2Email = 'p3g.owner2@test.com';
    const recep1Email = 'p3g.recep1@test.com';
    const password = 'Password123!';

    let adminToken = '';
    let patientToken = '';
    let owner1Token = '';
    let ph1Id = '';
    let ph2Id = '';
    let staff1Id = '';

    const cleanup = async () => {
        const pharmacies = await prisma.pharmacy.findMany({
            where: { phone: { in: [owner1Phone, owner2Phone] } },
            select: { id: true },
        });
        const phIds = pharmacies.map((p) => p.id);
        if (phIds.length > 0) {
            const staffRows = await prisma.pharmacyStaff.findMany({ where: { pharmacyId: { in: phIds } }, select: { id: true } });
            const staffIds = staffRows.map((s) => s.id);
            await prisma.auditLog.deleteMany({ where: { entityId: { in: [...phIds, ...staffIds] } } });
            await prisma.pharmacyStaff.deleteMany({ where: { pharmacyId: { in: phIds } } });
            await prisma.pharmacy.deleteMany({ where: { id: { in: phIds } } });
        }
        await prisma.user.deleteMany({
            where: {
                OR: [
                    { phone: { in: [adminPhone, patientPhone, owner1Phone, owner2Phone, recep1Phone, recep2Phone] } },
                    { email: { in: [owner1Email, owner2Email, recep1Email] } },
                ],
            },
        });
        await prisma.location.deleteMany({ where: { city: 'Test City3G' } });
    };

    beforeAll(async () => {
        await cleanup();

        await request(app).post('/api/v1/auth/register').send({ fullName: 'Test 3G Admin', phone: adminPhone, password });
        const superAdminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'SUPER_ADMIN' } });
        await prisma.user.update({ where: { phone: adminPhone }, data: { roleId: superAdminRole.id } });
        adminToken = (await request(app).post('/api/v1/auth/login').send({ identifier: adminPhone, password })).body.data.accessToken;

        await request(app).post('/api/v1/auth/register').send({ fullName: 'Test 3G Patient', phone: patientPhone, password });
        patientToken = (await request(app).post('/api/v1/auth/login').send({ identifier: patientPhone, password })).body.data.accessToken;

        const loc = await prisma.location.create({
            data: { city: 'Test City3G', area: 'Hub', state: 'WB', pincode: '713340', uniqueKey: 'test-city3g-hub-713340', isActive: true },
        });

        const res1 = await request(app)
            .post('/api/v1/pharmacies/admin-create')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                name: 'Test P3G Shop1',
                ownerName: 'Test 3G Owner1',
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
                name: 'Test P3G Shop2',
                ownerName: 'Test 3G Owner2',
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

    it('1. Owner creates a Receptionist for own pharmacy (201)', async () => {
        const res = await request(app)
            .post(`/api/v1/pharmacies/${ph1Id}/receptionists`)
            .set('Authorization', `Bearer ${owner1Token}`)
            .send({ fullName: 'Test Recep 1', phone: recep1Phone, email: recep1Email, password });
        expect(res.status).toBe(201);
        expect(res.body.data.staffRole).toBe('RECEPTIONIST');
        expect(res.body.data.user.phone).toBe(recep1Phone);
        staff1Id = res.body.data.id;
    });

    it('2. Created Receptionist can log in with RECEPTIONIST role (200)', async () => {
        const res = await request(app).post('/api/v1/auth/login').send({ identifier: recep1Phone, password });
        expect(res.status).toBe(200);
        expect(res.body.data.user.role).toBe('RECEPTIONIST');
    });

    it('3. Duplicate phone returns 409', async () => {
        const res = await request(app)
            .post(`/api/v1/pharmacies/${ph1Id}/receptionists`)
            .set('Authorization', `Bearer ${owner1Token}`)
            .send({ fullName: 'Dup Recep', phone: recep1Phone, password });
        expect(res.status).toBe(409);
    });

    it('4. Owner lists own pharmacy receptionists (200)', async () => {
        const res = await request(app)
            .get(`/api/v1/pharmacies/${ph1Id}/receptionists`)
            .set('Authorization', `Bearer ${owner1Token}`);
        expect(res.status).toBe(200);
        expect(res.body.data.some((s: any) => s.id === staff1Id)).toBe(true);
    });

    it('5. Owner deactivates and reactivates receptionist (200)', async () => {
        const off = await request(app)
            .patch(`/api/v1/pharmacies/${ph1Id}/receptionists/${staff1Id}/status`)
            .set('Authorization', `Bearer ${owner1Token}`)
            .send({ isActive: false });
        expect(off.status).toBe(200);
        expect(off.body.data.isActive).toBe(false);

        const on = await request(app)
            .patch(`/api/v1/pharmacies/${ph1Id}/receptionists/${staff1Id}/status`)
            .set('Authorization', `Bearer ${owner1Token}`)
            .send({ isActive: true });
        expect(on.status).toBe(200);
        expect(on.body.data.isActive).toBe(true);
    });

    it('6. Owner cannot create receptionist for another pharmacy (403)', async () => {
        const res = await request(app)
            .post(`/api/v1/pharmacies/${ph2Id}/receptionists`)
            .set('Authorization', `Bearer ${owner1Token}`)
            .send({ fullName: 'Hack Recep', phone: recep2Phone, password });
        expect(res.status).toBe(403);
    });

    it('7. Super Admin can create receptionist for any pharmacy (201)', async () => {
        const res = await request(app)
            .post(`/api/v1/pharmacies/${ph2Id}/receptionists`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ fullName: 'Test Recep 2', phone: recep2Phone, password });
        expect(res.status).toBe(201);
    });

    it('8. Patient cannot create or list receptionists (403)', async () => {
        const res = await request(app)
            .get(`/api/v1/pharmacies/${ph1Id}/receptionists`)
            .set('Authorization', `Bearer ${patientToken}`);
        expect(res.status).toBe(403);
    });

    it('9. Short password returns 400', async () => {
        const res = await request(app)
            .post(`/api/v1/pharmacies/${ph1Id}/receptionists`)
            .set('Authorization', `Bearer ${owner1Token}`)
            .send({ fullName: 'Bad Pass', phone: '5555557599', password: '123' });
        expect(res.status).toBe(400);
    });

    it('10. Audit logs have RECEPTIONIST_CREATED and RECEPTIONIST_STATUS_UPDATED', async () => {
        const logs = await prisma.auditLog.findMany({ where: { entityId: staff1Id }, select: { action: true } });
        const actions = logs.map((l) => l.action);
        expect(actions).toContain('RECEPTIONIST_CREATED');
        expect(actions).toContain('RECEPTIONIST_STATUS_UPDATED');
    });
});
