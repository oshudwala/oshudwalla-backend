import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/config/prisma';

jest.setTimeout(180000);

describe('Step 3B-3: Super Admin updates pharmacy locationId or status', () => {
    const adminPhone = '5555555631';
    const patientPhone = '5555555632';
    const owner1Phone = '5555556901';
    const owner2Phone = '5555556902';
    const owner1Email = 'p3b3.owner1@test.com';
    const owner2Email = 'p3b3.owner2@test.com';
    const password = 'Password123!';
    const fakeUuid = '00000000-0000-4000-8000-000000000000';

    let adminToken = '';
    let patientToken = '';
    let owner1Token = '';
    let locAId = '';
    let locBId = '';
    let locInactiveId = '';
    let normalPharmacyId = '';
    let primaryPharmacyId = '';

    const adminPut = (id: string, token: string, body: any) =>
        request(app)
            .put(`/api/v1/pharmacies/admin-update/${id}`)
            .set('Authorization', `Bearer ${token}`)
            .send(body);

    const cleanup = async () => {
        const pharmacies = await prisma.pharmacy.findMany({
            where: { phone: { in: [owner1Phone, owner2Phone] } },
            select: { id: true },
        });
        const phIds = pharmacies.map((p) => p.id);
        if (phIds.length > 0) {
            await prisma.auditLog.deleteMany({ where: { entityId: { in: phIds } } });
            await prisma.pharmacyStaff.deleteMany({ where: { pharmacyId: { in: phIds } } });
            await prisma.pharmacy.deleteMany({ where: { id: { in: phIds } } });
        }
        await prisma.user.deleteMany({
            where: {
                OR: [
                    { phone: { in: [adminPhone, patientPhone, owner1Phone, owner2Phone] } },
                    { email: { in: [owner1Email, owner2Email] } },
                ],
            },
        });
        await prisma.location.deleteMany({
            where: { city: { in: ['Test City3B3A', 'Test City3B3B', 'Test City3B3Inactive'] } },
        });
    };

    beforeAll(async () => {
        await cleanup();

        // Create Super Admin user
        await request(app).post('/api/v1/auth/register').send({
            fullName: 'Test 3B3 Admin',
            phone: adminPhone,
            password,
        });
        const superAdminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'SUPER_ADMIN' } });
        await prisma.user.update({ where: { phone: adminPhone }, data: { roleId: superAdminRole.id } });
        const adminLogin = await request(app).post('/api/v1/auth/login').send({ identifier: adminPhone, password });
        adminToken = adminLogin.body.data.accessToken;

        // Create Patient user
        await request(app).post('/api/v1/auth/register').send({
            fullName: 'Test 3B3 Patient',
            phone: patientPhone,
            password,
        });
        const patientLogin = await request(app).post('/api/v1/auth/login').send({ identifier: patientPhone, password });
        patientToken = patientLogin.body.data.accessToken;

        // Create 3 locations (2 active, 1 inactive)
        const locA = await prisma.location.create({
            data: { city: 'Test City3B3A', area: 'Area A', state: 'WB', pincode: '713301', uniqueKey: 'test-city3b3a-area-a-713301', isActive: true },
        });
        const locB = await prisma.location.create({
            data: { city: 'Test City3B3B', area: 'Area B', state: 'WB', pincode: '713302', uniqueKey: 'test-city3b3b-area-b-713302', isActive: true },
        });
        const locInactive = await prisma.location.create({
            data: { city: 'Test City3B3Inactive', area: 'Area Off', state: 'WB', pincode: '713303', uniqueKey: 'test-city3b3inactive-area-off-713303', isActive: false },
        });
        locAId = locA.id;
        locBId = locB.id;
        locInactiveId = locInactive.id;

        // Create normal pharmacy + owner
        const res1 = await request(app)
            .post('/api/v1/pharmacies/admin-create')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                name: 'Test P3B3 Shop1',
                ownerName: 'Test Owner1',
                ownerEmail: owner1Email,
                ownerPassword: password,
                phone: owner1Phone,
                locationId: locAId,
                line1: 'Road 1',
                isPrimary: false,
            });
        normalPharmacyId = res1.body.data.id;

        const owner1Login = await request(app).post('/api/v1/auth/login').send({ identifier: owner1Phone, password });
        owner1Token = owner1Login.body.data.accessToken;

        // Create primary pharmacy + owner
        const res2 = await request(app)
            .post('/api/v1/pharmacies/admin-create')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                name: 'Test P3B3 Primary',
                ownerName: 'Test Owner2',
                ownerEmail: owner2Email,
                ownerPassword: password,
                phone: owner2Phone,
                locationId: locAId,
                line1: 'Road 2',
                isPrimary: true,
            });
        primaryPharmacyId = res2.body.data.id;
    });

    afterAll(async () => {
        await cleanup();
    });

    it('1. Super Admin changes pharmacy locationId (200) and city/state/pincode sync', async () => {
        const res = await adminPut(normalPharmacyId, adminToken, { locationId: locBId });
        expect(res.status).toBe(200);
        expect(res.body.data.locationId).toBe(locBId);
        expect(res.body.data.city).toBe('Test City3B3B');
        expect(res.body.data.pincode).toBe('713302');

        const row = await prisma.pharmacy.findUnique({ where: { id: normalPharmacyId } });
        expect(row?.locationId).toBe(locBId);
        expect(row?.city).toBe('Test City3B3B');
    });

    it('2. Super Admin suspends a non-primary pharmacy (200) and hides it from active lists', async () => {
        const res = await adminPut(normalPharmacyId, adminToken, { status: 'SUSPENDED' });
        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe('SUSPENDED');

        const listRes = await request(app)
            .get('/api/v1/pharmacies')
            .set('Authorization', `Bearer ${adminToken}`);
        expect(listRes.body.data.some((p: any) => p.id === normalPharmacyId)).toBe(false);

        const myRes = await request(app)
            .get('/api/v1/pharmacies/my')
            .set('Authorization', `Bearer ${owner1Token}`);
        expect(myRes.body.data.some((p: any) => p.id === normalPharmacyId)).toBe(false);
    });

    it('3. Super Admin reactivates a suspended pharmacy (200)', async () => {
        const res = await adminPut(normalPharmacyId, adminToken, { status: 'ACTIVE' });
        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe('ACTIVE');

        const row = await prisma.pharmacy.findUnique({ where: { id: normalPharmacyId } });
        expect(row?.status).toBe('ACTIVE');
    });

    it('4. Super Admin updates both locationId and status together (200)', async () => {
        const res = await adminPut(normalPharmacyId, adminToken, { locationId: locAId, status: 'SUSPENDED' });
        expect(res.status).toBe(200);
        expect(res.body.data.locationId).toBe(locAId);
        expect(res.body.data.city).toBe('Test City3B3A');
        expect(res.body.data.status).toBe('SUSPENDED');

        // restore to ACTIVE
        await adminPut(normalPharmacyId, adminToken, { status: 'ACTIVE' });
    });

    it('5. Cannot suspend the Primary Pharmacy (400)', async () => {
        const res = await adminPut(primaryPharmacyId, adminToken, { status: 'SUSPENDED' });
        expect(res.status).toBe(400);
        const row = await prisma.pharmacy.findUnique({ where: { id: primaryPharmacyId } });
        expect(row?.status).toBe('ACTIVE');
    });

    it('6. Inactive locationId returns 400', async () => {
        const res = await adminPut(normalPharmacyId, adminToken, { locationId: locInactiveId });
        expect(res.status).toBe(400);
    });

    it('7. Unknown locationId returns 404', async () => {
        const res = await adminPut(normalPharmacyId, adminToken, { locationId: fakeUuid });
        expect(res.status).toBe(404);
    });

    it('8. Unknown pharmacy id returns 404', async () => {
        const res = await adminPut(fakeUuid, adminToken, { status: 'SUSPENDED' });
        expect(res.status).toBe(404);
    });

    it('9. Invalid pharmacy id returns 400', async () => {
        const res = await adminPut('not-a-uuid', adminToken, { status: 'SUSPENDED' });
        expect(res.status).toBe(400);
    });

    it('10. Invalid status value returns 400', async () => {
        const res = await adminPut(normalPharmacyId, adminToken, { status: 'DELETED' });
        expect(res.status).toBe(400);
    });

    it('11. Empty body returns 400', async () => {
        const res = await adminPut(normalPharmacyId, adminToken, {});
        expect(res.status).toBe(400);
    });

    it('12. Pharmacy owner cannot call admin-update (403)', async () => {
        const res = await adminPut(normalPharmacyId, owner1Token, { status: 'SUSPENDED' });
        expect(res.status).toBe(403);
    });

    it('13. Patient cannot call admin-update (403)', async () => {
        const res = await adminPut(normalPharmacyId, patientToken, { status: 'SUSPENDED' });
        expect(res.status).toBe(403);
    });

    it('14. No token returns 401', async () => {
        const res = await request(app)
            .put(`/api/v1/pharmacies/admin-update/${normalPharmacyId}`)
            .send({ status: 'SUSPENDED' });
        expect(res.status).toBe(401);
    });

    it('15. Audit log has PHARMACY_ADMIN_UPDATED', async () => {
        const log = await prisma.auditLog.findFirst({
            where: { entityId: normalPharmacyId, action: 'PHARMACY_ADMIN_UPDATED' },
            orderBy: { createdAt: 'desc' },
        });
        expect(log).not.toBeNull();
        expect(log?.actorRole).toBe('SUPER_ADMIN');
        expect(log?.before).toBeTruthy();
        expect(log?.after).toBeTruthy();
    });
});
