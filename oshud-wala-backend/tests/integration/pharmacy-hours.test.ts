import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/config/prisma';

jest.setTimeout(180000);

describe('Step 3E: Pharmacy opening hours and holidays', () => {
    const adminPhone = '5555555661';
    const patientPhone = '5555555662';
    const owner1Phone = '5555557401';
    const owner2Phone = '5555557402';
    const owner1Email = 'p3e.owner1@test.com';
    const owner2Email = 'p3e.owner2@test.com';
    const password = 'Password123!';

    let adminToken = '';
    let patientToken = '';
    let owner1Token = '';
    let ph1Id = '';
    let ph2Id = '';
    let createdHolidayId = '';

    const cleanup = async () => {
        const pharmacies = await prisma.pharmacy.findMany({
            where: { phone: { in: [owner1Phone, owner2Phone] } },
            select: { id: true },
        });
        const phIds = pharmacies.map((p) => p.id);
        if (phIds.length > 0) {
            await prisma.auditLog.deleteMany({ where: { entityId: { in: phIds } } });
            await prisma.pharmacyOpeningHour.deleteMany({ where: { pharmacyId: { in: phIds } } });
            await prisma.pharmacyHoliday.deleteMany({ where: { pharmacyId: { in: phIds } } });
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
        await prisma.location.deleteMany({ where: { city: 'Test City3E' } });
    };

    beforeAll(async () => {
        await cleanup();

        await request(app).post('/api/v1/auth/register').send({ fullName: 'Test 3E Admin', phone: adminPhone, password });
        const superAdminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'SUPER_ADMIN' } });
        await prisma.user.update({ where: { phone: adminPhone }, data: { roleId: superAdminRole.id } });
        adminToken = (await request(app).post('/api/v1/auth/login').send({ identifier: adminPhone, password })).body.data.accessToken;

        await request(app).post('/api/v1/auth/register').send({ fullName: 'Test 3E Patient', phone: patientPhone, password });
        patientToken = (await request(app).post('/api/v1/auth/login').send({ identifier: patientPhone, password })).body.data.accessToken;

        const loc = await prisma.location.create({
            data: { city: 'Test City3E', area: 'Main', state: 'WB', pincode: '713330', uniqueKey: 'test-city3e-main-713330', isActive: true },
        });

        const res1 = await request(app)
            .post('/api/v1/pharmacies/admin-create')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                name: 'Test P3E Shop1',
                ownerName: 'Test 3E Owner1',
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
                name: 'Test P3E Shop2',
                ownerName: 'Test 3E Owner2',
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

    it('1. Owner sets weekly opening hours (200)', async () => {
        const res = await request(app)
            .put(`/api/v1/pharmacies/${ph1Id}/hours`)
            .set('Authorization', `Bearer ${owner1Token}`)
            .send({
                hours: [
                    { dayOfWeek: 0, isClosed: true },
                    { dayOfWeek: 1, isClosed: false, openMinute: 540, closeMinute: 1260 },
                    { dayOfWeek: 2, isClosed: false, openMinute: 540, closeMinute: 1260 },
                ],
            });
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(3);
        expect(res.body.data[0].isClosed).toBe(true);
        expect(res.body.data[1].openMinute).toBe(540);
    });

    it('2. Duplicate dayOfWeek returns 400', async () => {
        const res = await request(app)
            .put(`/api/v1/pharmacies/${ph1Id}/hours`)
            .set('Authorization', `Bearer ${owner1Token}`)
            .send({
                hours: [
                    { dayOfWeek: 1, isClosed: false, openMinute: 540, closeMinute: 1200 },
                    { dayOfWeek: 1, isClosed: true },
                ],
            });
        expect(res.status).toBe(400);
    });

    it('3. openMinute >= closeMinute returns 400', async () => {
        const res = await request(app)
            .put(`/api/v1/pharmacies/${ph1Id}/hours`)
            .set('Authorization', `Bearer ${owner1Token}`)
            .send({
                hours: [{ dayOfWeek: 1, isClosed: false, openMinute: 1200, closeMinute: 540 }],
            });
        expect(res.status).toBe(400);
    });

    it('4. Owner adds a holiday (201)', async () => {
        const res = await request(app)
            .post(`/api/v1/pharmacies/${ph1Id}/holidays`)
            .set('Authorization', `Bearer ${owner1Token}`)
            .send({ holidayDate: '2026-12-25', reason: 'Christmas' });
        expect(res.status).toBe(201);
        expect(res.body.data.reason).toBe('Christmas');
        createdHolidayId = res.body.data.id;
    });

    it('5. Duplicate holiday date returns 409', async () => {
        const res = await request(app)
            .post(`/api/v1/pharmacies/${ph1Id}/holidays`)
            .set('Authorization', `Bearer ${owner1Token}`)
            .send({ holidayDate: '2026-12-25', reason: 'Duplicate' });
        expect(res.status).toBe(409);
    });

    it('6. Patient can view hours and holidays (200)', async () => {
        const res = await request(app)
            .get(`/api/v1/pharmacies/${ph1Id}/hours`)
            .set('Authorization', `Bearer ${patientToken}`);
        expect(res.status).toBe(200);
        expect(res.body.data.hours).toHaveLength(3);
        expect(res.body.data.holidays).toHaveLength(1);
    });

    it('7. Owner cannot edit another pharmacy hours (403)', async () => {
        const res = await request(app)
            .put(`/api/v1/pharmacies/${ph2Id}/hours`)
            .set('Authorization', `Bearer ${owner1Token}`)
            .send({ hours: [{ dayOfWeek: 0, isClosed: true }] });
        expect(res.status).toBe(403);
    });

    it('8. Patient cannot add holiday (403)', async () => {
        const res = await request(app)
            .post(`/api/v1/pharmacies/${ph1Id}/holidays`)
            .set('Authorization', `Bearer ${patientToken}`)
            .send({ holidayDate: '2026-12-31' });
        expect(res.status).toBe(403);
    });

    it('9. Super Admin can update any pharmacy hours (200)', async () => {
        const res = await request(app)
            .put(`/api/v1/pharmacies/${ph2Id}/hours`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ hours: [{ dayOfWeek: 0, isClosed: true }] });
        expect(res.status).toBe(200);
    });

    it('10. Owner deletes a holiday (200)', async () => {
        const res = await request(app)
            .delete(`/api/v1/pharmacies/${ph1Id}/holidays/${createdHolidayId}`)
            .set('Authorization', `Bearer ${owner1Token}`);
        expect(res.status).toBe(200);
        expect(res.body.data.deleted).toBe(true);
    });

    it('11. Deleting already deleted holiday returns 404', async () => {
        const res = await request(app)
            .delete(`/api/v1/pharmacies/${ph1Id}/holidays/${createdHolidayId}`)
            .set('Authorization', `Bearer ${owner1Token}`);
        expect(res.status).toBe(404);
    });

    it('12. Audit logs have PHARMACY_HOURS_UPDATED, PHARMACY_HOLIDAY_ADDED, PHARMACY_HOLIDAY_REMOVED', async () => {
        const logs = await prisma.auditLog.findMany({
            where: { entityId: ph1Id },
            select: { action: true },
        });
        const actions = logs.map((l) => l.action);
        expect(actions).toContain('PHARMACY_HOURS_UPDATED');
        expect(actions).toContain('PHARMACY_HOLIDAY_ADDED');
        expect(actions).toContain('PHARMACY_HOLIDAY_REMOVED');
    });
});
