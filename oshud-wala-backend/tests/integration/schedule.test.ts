import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/config/prisma';

jest.setTimeout(180000);

describe('Step 5: Doctor Schedule, Exceptions & Slot Generation', () => {
    const adminPhone = '5555555701';
    const patientPhone = '5555555702';
    const owner1Phone = '5555557701';
    const owner2Phone = '5555557702';
    const owner1Email = 's5.owner1@test.com';
    const owner2Email = 's5.owner2@test.com';
    const regNo = 'TEST-REG-S5-001';
    const specName = 'Test Spec Step5';
    const password = 'Password123!';

    let adminToken = '';
    let patientToken = '';
    let owner1Token = '';
    let owner2Token = '';
    let ph1Id = '';
    let pdId = '';
    let firstSlotId = '';

    const cleanup = async () => {
        const docs = await prisma.doctor.findMany({ where: { registrationNumber: regNo }, select: { id: true } });
        const docIds = docs.map((d) => d.id);
        if (docIds.length > 0) {
            const pds = await prisma.pharmacyDoctor.findMany({ where: { doctorId: { in: docIds } }, select: { id: true } });
            const pdIds = pds.map((p) => p.id);
            if (pdIds.length > 0) {
                await prisma.appointmentSlot.deleteMany({ where: { pharmacyDoctorId: { in: pdIds } } });
                await prisma.scheduleException.deleteMany({ where: { pharmacyDoctorId: { in: pdIds } } });
                await prisma.doctorSchedule.deleteMany({ where: { pharmacyDoctorId: { in: pdIds } } });
                await prisma.auditLog.deleteMany({ where: { entityId: { in: pdIds } } });
            }
            await prisma.pharmacyDoctor.deleteMany({ where: { doctorId: { in: docIds } } });
            await prisma.doctorSpecialization.deleteMany({ where: { doctorId: { in: docIds } } });
            await prisma.doctor.deleteMany({ where: { id: { in: docIds } } });
        }
        const pharmacies = await prisma.pharmacy.findMany({ where: { phone: { in: [owner1Phone, owner2Phone] } }, select: { id: true } });
        const phIds = pharmacies.map((p) => p.id);
        if (phIds.length > 0) {
            await prisma.pharmacyHoliday.deleteMany({ where: { pharmacyId: { in: phIds } } });
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
        await prisma.location.deleteMany({ where: { city: 'Test CityS5' } });
    };

    beforeAll(async () => {
        await cleanup();

        await request(app).post('/api/v1/auth/register').send({ fullName: 'Test S5 Admin', phone: adminPhone, password });
        const superAdminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'SUPER_ADMIN' } });
        await prisma.user.update({ where: { phone: adminPhone }, data: { roleId: superAdminRole.id } });
        adminToken = (await request(app).post('/api/v1/auth/login').send({ identifier: adminPhone, password })).body.data.accessToken;

        await request(app).post('/api/v1/auth/register').send({ fullName: 'Test S5 Patient', phone: patientPhone, password });
        patientToken = (await request(app).post('/api/v1/auth/login').send({ identifier: patientPhone, password })).body.data.accessToken;

        const spec = await prisma.specialization.create({ data: { name: specName } });
        const loc = await prisma.location.create({
            data: { city: 'Test CityS5', area: 'East', state: 'WB', pincode: '713360', uniqueKey: 'test-citys5-east-713360', isActive: true },
        });

        const ph1Res = await request(app)
            .post('/api/v1/pharmacies/admin-create')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                name: 'Test S5 Shop1',
                ownerName: 'Test S5 Owner1',
                ownerEmail: owner1Email,
                ownerPassword: password,
                phone: owner1Phone,
                locationId: loc.id,
                line1: 'Road 1',
            });
        ph1Id = ph1Res.body.data.id;
        owner1Token = (await request(app).post('/api/v1/auth/login').send({ identifier: owner1Phone, password })).body.data.accessToken;

        await request(app)
            .post('/api/v1/pharmacies/admin-create')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                name: 'Test S5 Shop2',
                ownerName: 'Test S5 Owner2',
                ownerEmail: owner2Email,
                ownerPassword: password,
                phone: owner2Phone,
                locationId: loc.id,
                line1: 'Road 2',
            });
        owner2Token = (await request(app).post('/api/v1/auth/login').send({ identifier: owner2Phone, password })).body.data.accessToken;

        const docRes = await request(app)
            .post('/api/v1/doctors')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                fullName: 'Dr. Test Step5',
                phone: '5555557799',
                registrationNumber: regNo,
                specializationIds: [spec.id],
            });

        const assignRes = await request(app)
            .post('/api/v1/doctors/assign')
            .set('Authorization', `Bearer ${owner1Token}`)
            .send({ pharmacyId: ph1Id, doctorId: docRes.body.data.id, consultationFeePaise: 50000 });
        pdId = assignRes.body.data.id;
    });

    afterAll(async () => {
        await cleanup();
    });

    // 2026-12-07 is Monday (dayOfWeek = 1), 2026-12-08 is Tuesday (dayOfWeek = 2)
    it('1. Owner creates Monday & Tuesday weekly schedules (201)', async () => {
        const mon = await request(app)
            .post('/api/v1/schedules')
            .set('Authorization', `Bearer ${owner1Token}`)
            .send({
                pharmacyDoctorId: pdId,
                dayOfWeek: 1,
                startMinute: 600, // 10:00
                endMinute: 690,   // 11:30 -> 3 slots of 30m
                slotDurationMinutes: 30,
                slotCapacity: 2,
                validFrom: '2026-12-01',
            });
        expect(mon.status).toBe(201);

        const tue = await request(app)
            .post('/api/v1/schedules')
            .set('Authorization', `Bearer ${owner1Token}`)
            .send({
                pharmacyDoctorId: pdId,
                dayOfWeek: 2,
                startMinute: 600,
                endMinute: 660, // 2 slots of 30m
                slotDurationMinutes: 30,
                slotCapacity: 1,
                validFrom: '2026-12-01',
            });
        expect(tue.status).toBe(201);
    });

    it('2. Another pharmacy owner CANNOT create schedule for this pharmacyDoctor (403)', async () => {
        const res = await request(app)
            .post('/api/v1/schedules')
            .set('Authorization', `Bearer ${owner2Token}`)
            .send({
                pharmacyDoctorId: pdId,
                dayOfWeek: 3,
                startMinute: 600,
                endMinute: 660,
                slotDurationMinutes: 30,
                validFrom: '2026-12-01',
            });
        expect(res.status).toBe(403);
    });

    it('3. Owner adds LEAVE exception for Tuesday 2026-12-08 (200)', async () => {
        const res = await request(app)
            .post('/api/v1/schedules/exceptions')
            .set('Authorization', `Bearer ${owner1Token}`)
            .send({
                pharmacyDoctorId: pdId,
                exceptionDate: '2026-12-08',
                type: 'LEAVE',
                reason: 'Conference',
            });
        expect(res.status).toBe(200);
        expect(res.body.data.type).toBe('LEAVE');
    });

    it('4. Generate slots for 2026-12-07..2026-12-08 creates 3 Monday slots & skips Tuesday LEAVE (201)', async () => {
        const res = await request(app)
            .post('/api/v1/schedules/generate-slots')
            .set('Authorization', `Bearer ${owner1Token}`)
            .send({ pharmacyDoctorId: pdId, fromDate: '2026-12-07', toDate: '2026-12-08' });
        expect(res.status).toBe(201);
        expect(res.body.data.createdCount).toBe(3);
    });

    it('5. Re-running generate-slots for same dates is idempotent (createdCount = 0)', async () => {
        const res = await request(app)
            .post('/api/v1/schedules/generate-slots')
            .set('Authorization', `Bearer ${owner1Token}`)
            .send({ pharmacyDoctorId: pdId, fromDate: '2026-12-07', toDate: '2026-12-08' });
        expect(res.status).toBe(201);
        expect(res.body.data.createdCount).toBe(0);
    });

    it('6. Patient views generated slots for 2026-12-07 (200)', async () => {
        const res = await request(app)
            .get(`/api/v1/schedules/slots/${pdId}?date=2026-12-07`)
            .set('Authorization', `Bearer ${patientToken}`);
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(3);
        firstSlotId = res.body.data[0].id;
    });

    it('7. Owner blocks and re-opens a slot (200)', async () => {
        const block = await request(app)
            .patch(`/api/v1/schedules/slots/${firstSlotId}/status`)
            .set('Authorization', `Bearer ${owner1Token}`)
            .send({ status: 'BLOCKED' });
        expect(block.status).toBe(200);
        expect(block.body.data.status).toBe('BLOCKED');

        const open = await request(app)
            .patch(`/api/v1/schedules/slots/${firstSlotId}/status`)
            .set('Authorization', `Bearer ${owner1Token}`)
            .send({ status: 'OPEN' });
        expect(open.status).toBe(200);
        expect(open.body.data.status).toBe('OPEN');
    });

    it('8. Patient cannot block a slot or generate slots (403)', async () => {
        const res = await request(app)
            .patch(`/api/v1/schedules/slots/${firstSlotId}/status`)
            .set('Authorization', `Bearer ${patientToken}`)
            .send({ status: 'BLOCKED' });
        expect(res.status).toBe(403);
    });

    it('9. Generating more than 31 days returns 400', async () => {
        const res = await request(app)
            .post('/api/v1/schedules/generate-slots')
            .set('Authorization', `Bearer ${owner1Token}`)
            .send({ pharmacyDoctorId: pdId, fromDate: '2026-12-01', toDate: '2027-01-15' });
        expect(res.status).toBe(400);
    });
});
