import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/config/prisma';

jest.setTimeout(180000);

describe('Step 3D: Pharmacy Clinic / Medicine service toggle (SUPER_ADMIN only)', () => {
    const adminPhone = '5555555651';
    const patientPhone = '5555555652';
    const owner1Phone = '5555557301';
    const owner1Email = 'p3d.owner1@test.com';
    const password = 'Password123!';
    const fakeUuid = '00000000-0000-4000-8000-000000000000';

    let adminToken = '';
    let patientToken = '';
    let owner1Token = '';
    let ph1Id = '';

    const putServices = (id: string, token: string, body: any) =>
        request(app)
            .put(`/api/v1/pharmacies/${id}/services`)
            .set('Authorization', `Bearer ${token}`)
            .send(body);

    const cleanup = async () => {
        const pharmacies = await prisma.pharmacy.findMany({ where: { phone: owner1Phone }, select: { id: true } });
        const phIds = pharmacies.map((p) => p.id);
        if (phIds.length > 0) {
            await prisma.auditLog.deleteMany({ where: { entityId: { in: phIds } } });
            await prisma.pharmacyStaff.deleteMany({ where: { pharmacyId: { in: phIds } } });
            await prisma.pharmacy.deleteMany({ where: { id: { in: phIds } } });
        }
        await prisma.user.deleteMany({
            where: { OR: [{ phone: { in: [adminPhone, patientPhone, owner1Phone] } }, { email: owner1Email }] },
        });
        await prisma.location.deleteMany({ where: { city: 'Test City3D' } });
    };

    beforeAll(async () => {
        await cleanup();

        await request(app).post('/api/v1/auth/register').send({ fullName: 'Test 3D Admin', phone: adminPhone, password });
        const superAdminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'SUPER_ADMIN' } });
        await prisma.user.update({ where: { phone: adminPhone }, data: { roleId: superAdminRole.id } });
        adminToken = (await request(app).post('/api/v1/auth/login').send({ identifier: adminPhone, password })).body.data.accessToken;

        await request(app).post('/api/v1/auth/register').send({ fullName: 'Test 3D Patient', phone: patientPhone, password });
        patientToken = (await request(app).post('/api/v1/auth/login').send({ identifier: patientPhone, password })).body.data.accessToken;

        const loc = await prisma.location.create({
            data: { city: 'Test City3D', area: 'Zone', state: 'WB', pincode: '713320', uniqueKey: 'test-city3d-zone-713320', isActive: true },
        });

        const res1 = await request(app)
            .post('/api/v1/pharmacies/admin-create')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                name: 'Test P3D Shop1',
                ownerName: 'Test 3D Owner1',
                ownerEmail: owner1Email,
                ownerPassword: password,
                phone: owner1Phone,
                locationId: loc.id,
                line1: 'Road 1',
            });
        ph1Id = res1.body.data.id;
        owner1Token = (await request(app).post('/api/v1/auth/login').send({ identifier: owner1Phone, password })).body.data.accessToken;
    });

    afterAll(async () => {
        await cleanup();
    });

    it('1. Default services are hasMedicineService=true, hasClinicService=false', async () => {
        const row = await prisma.pharmacy.findUnique({ where: { id: ph1Id } });
        expect(row?.hasMedicineService).toBe(true);
        expect(row?.hasClinicService).toBe(false);
    });

    it('2. Super Admin enables Clinic service (Both) (200)', async () => {
        const res = await putServices(ph1Id, adminToken, { hasClinicService: true });
        expect(res.status).toBe(200);
        expect(res.body.data.hasClinicService).toBe(true);
        expect(res.body.data.hasMedicineService).toBe(true);
    });

    it('3. Super Admin sets Clinic-only (hasMedicineService=false) (200)', async () => {
        const res = await putServices(ph1Id, adminToken, { hasMedicineService: false });
        expect(res.status).toBe(200);
        expect(res.body.data.hasClinicService).toBe(true);
        expect(res.body.data.hasMedicineService).toBe(false);
    });

    it('4. Cannot disable both services at once (400)', async () => {
        const res = await putServices(ph1Id, adminToken, { hasClinicService: false, hasMedicineService: false });
        expect(res.status).toBe(400);
    });

    it('5. Cannot disable the last remaining active service (400)', async () => {
        const res = await putServices(ph1Id, adminToken, { hasClinicService: false });
        expect(res.status).toBe(400);
    });

    it('6. Pharmacy owner CANNOT change own service access (403)', async () => {
        const res = await putServices(ph1Id, owner1Token, { hasMedicineService: true });
        expect(res.status).toBe(403);
    });

    it('7. Patient CANNOT update pharmacy services (403)', async () => {
        const res = await putServices(ph1Id, patientToken, { hasMedicineService: true });
        expect(res.status).toBe(403);
    });

    it('8. No token returns 401', async () => {
        const res = await request(app).put(`/api/v1/pharmacies/${ph1Id}/services`).send({ hasClinicService: true });
        expect(res.status).toBe(401);
    });

    it('9. Empty body returns 400', async () => {
        const res = await putServices(ph1Id, adminToken, {});
        expect(res.status).toBe(400);
    });

    it('10. Unknown pharmacy returns 404', async () => {
        const res = await putServices(fakeUuid, adminToken, { hasClinicService: true });
        expect(res.status).toBe(404);
    });

    it('11. Audit log has PHARMACY_SERVICES_UPDATED', async () => {
        const log = await prisma.auditLog.findFirst({
            where: { entityId: ph1Id, action: 'PHARMACY_SERVICES_UPDATED' },
            orderBy: { createdAt: 'desc' },
        });
        expect(log).not.toBeNull();
        expect(log?.actorRole).toBe('SUPER_ADMIN');
    });
});
