import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/config/prisma';
import { generateAccessToken } from '../../src/utils/jwt.util';

jest.setTimeout(180000);

describe('Step 6: Appointment Booking & Live Queue', () => {
    const adminPhone = '5555555711';
    const patient1Phone = '5555555712';
    const patient2Phone = '5555555713';
    const ownerPhone = '5555557801';
    const recepPhone = '5555557802';
    const ownerEmail = 's6.owner@test.com';
    const regNo = 'TEST-REG-S6-001';
    const specName = 'Test Spec Step6';

    let patient1Token = '';
    let patient2Token = '';
    let recepToken = '';
    let pdId = '';
    let slotId = '';
    let apt1Id = '';

    const cleanup = async () => {
        const docs = await prisma.doctor.findMany({ where: { registrationNumber: regNo }, select: { id: true } });
        const docIds = docs.map((d) => d.id);
        if (docIds.length > 0) {
            const pds = await prisma.pharmacyDoctor.findMany({ where: { doctorId: { in: docIds } }, select: { id: true } });
            const pdIds = pds.map((p) => p.id);
            if (pdIds.length > 0) {
                const apts = await prisma.appointment.findMany({ where: { pharmacyDoctorId: { in: pdIds } }, select: { id: true } });
                const qDays = await prisma.queueDay.findMany({ where: { pharmacyDoctorId: { in: pdIds } }, select: { id: true } });
                await prisma.auditLog.deleteMany({ where: { entityId: { in: [...pdIds, ...apts.map((a) => a.id), ...qDays.map((q) => q.id)] } } });
                await prisma.appointment.deleteMany({ where: { pharmacyDoctorId: { in: pdIds } } });
                await prisma.queueDay.deleteMany({ where: { pharmacyDoctorId: { in: pdIds } } });
                await prisma.appointmentSlot.deleteMany({ where: { pharmacyDoctorId: { in: pdIds } } });
                await prisma.doctorSchedule.deleteMany({ where: { pharmacyDoctorId: { in: pdIds } } });
            }
            await prisma.pharmacyDoctor.deleteMany({ where: { doctorId: { in: docIds } } });
            await prisma.doctorSpecialization.deleteMany({ where: { doctorId: { in: docIds } } });
            await prisma.doctor.deleteMany({ where: { id: { in: docIds } } });
        }
        const pharmacies = await prisma.pharmacy.findMany({ where: { phone: ownerPhone }, select: { id: true } });
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
                    { phone: { in: [adminPhone, patient1Phone, patient2Phone, ownerPhone, recepPhone] } },
                    { email: ownerEmail },
                ],
            },
        });
        await prisma.location.deleteMany({ where: { city: 'Test CityS6' } });
    };

    beforeAll(async () => {
        await cleanup();

        const roles = await prisma.role.findMany();
        const roleMap = new Map(roles.map((r) => [r.name, r.id]));

        const [p1, p2, recep] = await Promise.all([
            prisma.user.create({
                data: { fullName: 'Test S6 Patient1', phone: patient1Phone, passwordHash: 'hash', roleId: roleMap.get('PATIENT')! },
            }),
            prisma.user.create({
                data: { fullName: 'Test S6 Patient2', phone: patient2Phone, passwordHash: 'hash', roleId: roleMap.get('PATIENT')! },
            }),
            prisma.user.create({
                data: { fullName: 'Test S6 Recep', phone: recepPhone, passwordHash: 'hash', roleId: roleMap.get('RECEPTIONIST')! },
            }),
        ]);

        patient1Token = generateAccessToken(p1.id, 'PATIENT');
        patient2Token = generateAccessToken(p2.id, 'PATIENT');
        recepToken = generateAccessToken(recep.id, 'RECEPTIONIST');

        const loc = await prisma.location.create({
            data: { city: 'Test CityS6', area: 'North', state: 'WB', pincode: '713370', uniqueKey: 'test-citys6-north-713370', isActive: true },
        });

        const pharmacy = await prisma.pharmacy.create({
            data: {
                name: 'Test S6 Clinic',
                phone: ownerPhone,
                email: ownerEmail,
                line1: 'Clinic Road',
                city: loc.city,
                state: loc.state,
                pincode: loc.pincode,
                locationId: loc.id,
                status: 'ACTIVE',
                hasClinicService: true,
            },
        });

        await prisma.pharmacyStaff.create({
            data: { userId: recep.id, pharmacyId: pharmacy.id, staffRole: 'RECEPTIONIST', isActive: true },
        });

        const doctor = await prisma.doctor.create({
            data: { fullName: 'Dr. Test Step6', phone: '5555557899', registrationNumber: regNo },
        });

        const pd = await prisma.pharmacyDoctor.create({
            data: { pharmacyId: pharmacy.id, doctorId: doctor.id, consultationFeePaise: 40000, isActive: true },
        });
        pdId = pd.id;

        const slot = await prisma.appointmentSlot.create({
            data: {
                pharmacyDoctorId: pd.id,
                slotDate: new Date('2026-12-14T00:00:00.000Z'),
                startMinute: 600,
                endMinute: 630,
                capacity: 1,
                bookedCount: 0,
                status: 'OPEN',
            },
        });
        slotId = slot.id;
    });

    afterAll(async () => {
        await cleanup();
    });

    it('1. Patient 1 books the slot with idempotencyKey and gets Token #1 (201)', async () => {
        const res = await request(app)
            .post('/api/v1/appointments')
            .set('Authorization', `Bearer ${patient1Token}`)
            .send({ slotId, reason: 'Fever', idempotencyKey: 'idem-s6-001' });
        expect(res.status).toBe(201);
        expect(res.body.data.tokenNumber).toBe(1);
        expect(res.body.data.feePaise).toBe(40000);
        apt1Id = res.body.data.id;
    });

    it('2. Same idempotencyKey returns the exact same appointment (no double booking)', async () => {
        const res = await request(app)
            .post('/api/v1/appointments')
            .set('Authorization', `Bearer ${patient1Token}`)
            .send({ slotId, reason: 'Fever', idempotencyKey: 'idem-s6-001' });
        expect(res.status).toBe(201);
        expect(res.body.data.id).toBe(apt1Id);
    });

    it('3. Patient 2 CANNOT overbook full slot (409)', async () => {
        const res = await request(app)
            .post('/api/v1/appointments')
            .set('Authorization', `Bearer ${patient2Token}`)
            .send({ slotId, reason: 'Cold' });
        expect(res.status).toBe(409);
    });

    it('4. Receptionist checks in Patient 1 and moves to IN_CONSULTATION (updates live queue currentTokenNumber)', async () => {
        const checkIn = await request(app)
            .patch(`/api/v1/appointments/${apt1Id}/status`)
            .set('Authorization', `Bearer ${recepToken}`)
            .send({ status: 'CHECKED_IN' });
        expect(checkIn.status).toBe(200);
        expect(checkIn.body.data.status).toBe('CHECKED_IN');

        const consult = await request(app)
            .patch(`/api/v1/appointments/${apt1Id}/status`)
            .set('Authorization', `Bearer ${recepToken}`)
            .send({ status: 'IN_CONSULTATION' });
        expect(consult.status).toBe(200);

        const queue = await request(app)
            .get(`/api/v1/appointments/queue/${pdId}?date=2026-12-14`)
            .set('Authorization', `Bearer ${patient1Token}`);
        expect(queue.status).toBe(200);
        expect(queue.body.data.currentTokenNumber).toBe(1);
        expect(queue.body.data.lastTokenIssued).toBe(1);
    });

    it('5. Receptionist pauses the queue (200)', async () => {
        const pause = await request(app)
            .patch(`/api/v1/appointments/queue/${pdId}/status`)
            .set('Authorization', `Bearer ${recepToken}`)
            .send({ queueDate: '2026-12-14', status: 'PAUSED' });
        expect(pause.status).toBe(200);
        expect(pause.body.data.status).toBe('PAUSED');
    });

    it('6. Patient 1 sees own appointment in /my (200)', async () => {
        const res = await request(app)
            .get('/api/v1/appointments/my')
            .set('Authorization', `Bearer ${patient1Token}`);
        expect(res.status).toBe(200);
        expect(res.body.data.some((a: any) => a.id === apt1Id)).toBe(true);
    });

    it('7. Receptionist completes appointment with doctorNotes (200)', async () => {
        const res = await request(app)
            .patch(`/api/v1/appointments/${apt1Id}/status`)
            .set('Authorization', `Bearer ${recepToken}`)
            .send({ status: 'COMPLETED', doctorNotes: 'Rest for 3 days' });
        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe('COMPLETED');
        expect(res.body.data.doctorNotes).toBe('Rest for 3 days');
    });

    it('8. Patient 2 cannot cancel Patient 1 appointment (403)', async () => {
        const res = await request(app)
            .patch(`/api/v1/appointments/${apt1Id}/cancel`)
            .set('Authorization', `Bearer ${patient2Token}`)
            .send({ cancelReason: 'Hack' });
        expect(res.status).toBe(403);
    });
});
