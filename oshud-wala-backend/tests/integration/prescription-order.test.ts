import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/config/prisma';
import { generateAccessToken } from '../../src/utils/jwt.util';

jest.setTimeout(180000);

describe('Step 8: Prescription (Cloudinary 48h TTL) & COD Order Lifecycle', () => {
    const patientPhone = '5555555731';
    const owner1Phone = '5555557901';
    const owner2Phone = '5555557902';
    const catSlug = 'test-s8-rx-cat';
    const prodSlug = 'test-s8-rx-med';

    let patientToken = '';
    let owner1Token = '';
    let clinicOnlyPhId = '';
    let medicinePhId = '';
    let addressId = '';
    let productId = '';
    let prescriptionId = '';
    let orderId = '';

    const cleanup = async () => {
        const users = await prisma.user.findMany({ where: { phone: { in: [patientPhone, owner1Phone, owner2Phone] } }, select: { id: true } });
        const userIds = users.map((u) => u.id);
        if (userIds.length > 0) {
            const orders = await prisma.order.findMany({ where: { patientId: { in: userIds } }, select: { id: true } });
            const rxs = await prisma.prescription.findMany({ where: { patientId: { in: userIds } }, select: { id: true } });
            await prisma.auditLog.deleteMany({ where: { entityId: { in: [...orders.map((o) => o.id), ...rxs.map((r) => r.id)] } } });
            await prisma.order.deleteMany({ where: { patientId: { in: userIds } } });
            await prisma.prescription.deleteMany({ where: { patientId: { in: userIds } } });
            await prisma.cart.deleteMany({ where: { userId: { in: userIds } } });
            await prisma.address.deleteMany({ where: { userId: { in: userIds } } });
        }
        const phs = await prisma.pharmacy.findMany({ where: { phone: { in: [owner1Phone, owner2Phone] } }, select: { id: true } });
        const phIds = phs.map((p) => p.id);
        if (phIds.length > 0) {
            await prisma.pharmacyStaff.deleteMany({ where: { pharmacyId: { in: phIds } } });
            await prisma.pharmacy.deleteMany({ where: { id: { in: phIds } } });
        }
        await prisma.product.deleteMany({ where: { slug: prodSlug } });
        await prisma.category.deleteMany({ where: { slug: catSlug } });
        if (userIds.length > 0) {
            await prisma.user.deleteMany({ where: { id: { in: userIds } } });
        }
    };

    beforeAll(async () => {
        await cleanup();
        const roles = await prisma.role.findMany();
        const roleMap = new Map(roles.map((r) => [r.name, r.id]));

        const [patient, owner1] = await Promise.all([
            prisma.user.create({ data: { fullName: 'Test S8 Patient', phone: patientPhone, passwordHash: 'hash', roleId: roleMap.get('PATIENT')! } }),
            prisma.user.create({ data: { fullName: 'Test S8 Owner1', phone: owner1Phone, passwordHash: 'hash', roleId: roleMap.get('PHARMACY')! } }),
        ]);

        patientToken = generateAccessToken(patient.id, 'PATIENT');
        owner1Token = generateAccessToken(owner1.id, 'PHARMACY');

        const [phMed, phClinic] = await Promise.all([
            prisma.pharmacy.create({
                data: {
                    name: 'Test S8 Med Pharmacy',
                    phone: owner1Phone,
                    line1: 'Road 1',
                    city: 'Durgapur',
                    state: 'WB',
                    pincode: '713216',
                    status: 'ACTIVE',
                    hasMedicineService: true,
                    hasClinicService: true,
                },
            }),
            prisma.pharmacy.create({
                data: {
                    name: 'Test S8 Clinic Only',
                    phone: owner2Phone,
                    line1: 'Road 2',
                    city: 'Durgapur',
                    state: 'WB',
                    pincode: '713216',
                    status: 'ACTIVE',
                    hasMedicineService: false,
                    hasClinicService: true,
                },
            }),
        ]);
        medicinePhId = phMed.id;
        clinicOnlyPhId = phClinic.id;

        await prisma.pharmacyStaff.create({
            data: { userId: owner1.id, pharmacyId: medicinePhId, staffRole: 'OWNER', isActive: true },
        });

        const addr = await prisma.address.create({
            data: {
                userId: patient.id,
                fullName: 'Test S8 Patient',
                phone: patientPhone,
                line1: 'City Centre',
                city: 'Durgapur',
                state: 'WB',
                pincode: '713216',
                isDefault: true,
            },
        });
        addressId = addr.id;

        const cat = await prisma.category.create({ data: { name: 'Test S8 Cat', slug: catSlug } });
        const prod = await prisma.product.create({
            data: {
                name: 'Test S8 Rx Antibiotic',
                slug: prodSlug,
                categoryId: cat.id,
                mrpPaise: 15000,
                requiresPrescription: true,
                isActive: true,
            },
        });
        productId = prod.id;
    });

    afterAll(async () => {
        await cleanup();
    });

    it('1. Submitting prescription to Clinic-only (hasMedicineService=false) returns 400', async () => {
        const res = await request(app)
            .post('/api/v1/prescriptions')
            .set('Authorization', `Bearer ${patientToken}`)
            .send({
                pharmacyId: clinicOnlyPhId,
                files: [{ storageKey: 'oshudwala/rx/test1', mimeType: 'image/jpeg', sizeBytes: 12000, checksumSha256: 'abc123456789' }],
            });
        expect(res.status).toBe(400);
    });

    it('2. Submitting prescription to Medicine-enabled pharmacy succeeds (201) with 48h expiresAt', async () => {
        const res = await request(app)
            .post('/api/v1/prescriptions')
            .set('Authorization', `Bearer ${patientToken}`)
            .send({
                pharmacyId: medicinePhId,
                doctorName: 'Dr. Sen',
                files: [{ storageKey: 'oshudwala/rx/test2', mimeType: 'image/png', sizeBytes: 24000, checksumSha256: 'def123456789' }],
            });
        expect(res.status).toBe(201);
        expect(res.body.data.status).toBe('SUBMITTED');
        expect(res.body.data.expiresAt).toBeTruthy();
        prescriptionId = res.body.data.id;
    });

    it('3. Pharmacy owner verifies the prescription (200)', async () => {
        const res = await request(app)
            .patch(`/api/v1/prescriptions/${prescriptionId}/review`)
            .set('Authorization', `Bearer ${owner1Token}`)
            .send({ status: 'VERIFIED' });
        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe('VERIFIED');
    });

    it('4. Placing COD order with Rx item WITHOUT prescriptionId returns 400', async () => {
        await request(app)
            .post('/api/v1/cart/items')
            .set('Authorization', `Bearer ${patientToken}`)
            .send({ productId, quantity: 2 });

        const res = await request(app)
            .post('/api/v1/orders')
            .set('Authorization', `Bearer ${patientToken}`)
            .send({ addressId, pharmacyId: medicinePhId });
        expect(res.status).toBe(400);
    });

    it('5. Placing COD order WITH valid prescriptionId succeeds (201), snapshots totalPaise & clears cart', async () => {
        const res = await request(app)
            .post('/api/v1/orders')
            .set('Authorization', `Bearer ${patientToken}`)
            .send({ addressId, pharmacyId: medicinePhId, prescriptionId, idempotencyKey: 'ord-s8-001' });
        expect(res.status).toBe(201);
        expect(res.body.data.paymentMethod).toBe('COD');
        expect(res.body.data.totalPaise).toBe(30000);
        expect(res.body.data.status).toBe('PENDING_PHARMACY_REVIEW');
        orderId = res.body.data.id;

        const cartRes = await request(app).get('/api/v1/cart').set('Authorization', `Bearer ${patientToken}`);
        expect(cartRes.body.data.items).toHaveLength(0);
    });

    it('6. Pharmacy owner moves order ACCEPTED -> PREPARING -> READY_FOR_PICKUP (200)', async () => {
        const r1 = await request(app).patch(`/api/v1/orders/${orderId}/status`).set('Authorization', `Bearer ${owner1Token}`).send({ status: 'ACCEPTED' });
        expect(r1.status).toBe(200);
        const r2 = await request(app).patch(`/api/v1/orders/${orderId}/status`).set('Authorization', `Bearer ${owner1Token}`).send({ status: 'PREPARING' });
        expect(r2.status).toBe(200);
        const r3 = await request(app).patch(`/api/v1/orders/${orderId}/status`).set('Authorization', `Bearer ${owner1Token}`).send({ status: 'READY_FOR_PICKUP' });
        expect(r3.status).toBe(200);
        expect(r3.body.data.status).toBe('READY_FOR_PICKUP');
    });

    it('7. Invalid state transition (READY_FOR_PICKUP -> ACCEPTED) returns 400', async () => {
        const res = await request(app)
            .patch(`/api/v1/orders/${orderId}/status`)
            .set('Authorization', `Bearer ${owner1Token}`)
            .send({ status: 'ACCEPTED' });
        expect(res.status).toBe(400);
    });

    it('8. Patient cannot cancel order once READY_FOR_PICKUP (400)', async () => {
        const res = await request(app)
            .patch(`/api/v1/orders/${orderId}/cancel`)
            .set('Authorization', `Bearer ${patientToken}`)
            .send({ cancelReason: 'Too late' });
        expect(res.status).toBe(400);
    });
});
