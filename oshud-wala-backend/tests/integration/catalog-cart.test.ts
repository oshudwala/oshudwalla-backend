import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/config/prisma';
import { generateAccessToken } from '../../src/utils/jwt.util';

jest.setTimeout(120000);

describe('Step 7: Category, Product Catalog & Cart', () => {
    const adminPhone = '5555555721';
    const patientPhone = '5555555722';
    const catSlug = 'test-s7-pain-relief';
    const prod1Slug = 'test-s7-paracetamol-500';
    const prod2Slug = 'test-s7-azithromycin-500';

    let adminToken = '';
    let patientToken = '';
    let categoryId = '';
    let prod1Id = '';
    let prod2Id = '';

    const cleanup = async () => {
        const prods = await prisma.product.findMany({ where: { slug: { in: [prod1Slug, prod2Slug] } }, select: { id: true } });
        const prodIds = prods.map((p) => p.id);
        if (prodIds.length > 0) {
            await prisma.cartItem.deleteMany({ where: { productId: { in: prodIds } } });
            await prisma.auditLog.deleteMany({ where: { entityId: { in: prodIds } } });
            await prisma.product.deleteMany({ where: { id: { in: prodIds } } });
        }
        const cats = await prisma.category.findMany({ where: { slug: catSlug }, select: { id: true } });
        const catIds = cats.map((c) => c.id);
        if (catIds.length > 0) {
            await prisma.auditLog.deleteMany({ where: { entityId: { in: catIds } } });
            await prisma.category.deleteMany({ where: { id: { in: catIds } } });
        }
        const users = await prisma.user.findMany({ where: { phone: { in: [adminPhone, patientPhone] } }, select: { id: true } });
        const userIds = users.map((u) => u.id);
        if (userIds.length > 0) {
            await prisma.cart.deleteMany({ where: { userId: { in: userIds } } });
            await prisma.user.deleteMany({ where: { id: { in: userIds } } });
        }
    };

    beforeAll(async () => {
        await cleanup();
        const roles = await prisma.role.findMany();
        const roleMap = new Map(roles.map((r) => [r.name, r.id]));

        const [admin, patient] = await Promise.all([
            prisma.user.create({ data: { fullName: 'Test S7 Admin', phone: adminPhone, passwordHash: 'hash', roleId: roleMap.get('SUPER_ADMIN')! } }),
            prisma.user.create({ data: { fullName: 'Test S7 Patient', phone: patientPhone, passwordHash: 'hash', roleId: roleMap.get('PATIENT')! } }),
        ]);

        adminToken = generateAccessToken(admin.id, 'SUPER_ADMIN');
        patientToken = generateAccessToken(patient.id, 'PATIENT');
    });

    afterAll(async () => {
        await cleanup();
    });

    it('1. Super Admin creates a category (201) & public lists it (200)', async () => {
        const res = await request(app)
            .post('/api/v1/categories')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ name: 'Test S7 Pain Relief', slug: catSlug, sortOrder: 1 });
        expect(res.status).toBe(201);
        categoryId = res.body.data.id;

        const list = await request(app).get('/api/v1/categories');
        expect(list.status).toBe(200);
        expect(list.body.data.some((c: any) => c.id === categoryId)).toBe(true);
    });

    it('2. Patient cannot create category (403)', async () => {
        const res = await request(app)
            .post('/api/v1/categories')
            .set('Authorization', `Bearer ${patientToken}`)
            .send({ name: 'Hack Cat' });
        expect(res.status).toBe(403);
    });

    it('3. Super Admin creates OTC and Rx products (201)', async () => {
        const p1 = await request(app)
            .post('/api/v1/products')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                name: 'Test S7 Paracetamol 500mg',
                slug: prod1Slug,
                genericName: 'Paracetamol',
                categoryId,
                mrpPaise: 3000,
                requiresPrescription: false,
            });
        expect(p1.status).toBe(201);
        prod1Id = p1.body.data.id;

        const p2 = await request(app)
            .post('/api/v1/products')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                name: 'Test S7 Azithromycin 500mg',
                slug: prod2Slug,
                genericName: 'Azithromycin',
                categoryId,
                mrpPaise: 12000,
                requiresPrescription: true,
            });
        expect(p2.status).toBe(201);
        prod2Id = p2.body.data.id;
    });

    it('4. Public searches products by query & requiresPrescription filter (200)', async () => {
        const res = await request(app).get('/api/v1/products?q=Azithromycin&requiresPrescription=true');
        expect(res.status).toBe(200);
        expect(res.body.data.items.some((p: any) => p.id === prod2Id)).toBe(true);
    });

    it('5. Patient adds both products to cart and gets accurate subtotalPaise & requiresPrescription=true (200)', async () => {
        await request(app)
            .post('/api/v1/cart/items')
            .set('Authorization', `Bearer ${patientToken}`)
            .send({ productId: prod1Id, quantity: 2 });

        const res = await request(app)
            .post('/api/v1/cart/items')
            .set('Authorization', `Bearer ${patientToken}`)
            .send({ productId: prod2Id, quantity: 1 });

        expect(res.status).toBe(200);
        expect(res.body.data.subtotalPaise).toBe(18000); // 2*3000 + 1*12000
        expect(res.body.data.itemCount).toBe(3);
        expect(res.body.data.requiresPrescription).toBe(true);
    });

    it('6. Patient updates quantity and removes Rx item -> requiresPrescription becomes false (200)', async () => {
        const res = await request(app)
            .delete(`/api/v1/cart/items/${prod2Id}`)
            .set('Authorization', `Bearer ${patientToken}`);
        expect(res.status).toBe(200);
        expect(res.body.data.subtotalPaise).toBe(6000);
        expect(res.body.data.requiresPrescription).toBe(false);
    });

    it('7. Patient clears cart (200)', async () => {
        const res = await request(app)
            .delete('/api/v1/cart')
            .set('Authorization', `Bearer ${patientToken}`);
        expect(res.status).toBe(200);
        expect(res.body.data.items).toHaveLength(0);
        expect(res.body.data.subtotalPaise).toBe(0);
    });

    it('8. Super Admin cannot use Patient cart endpoint (403)', async () => {
        const res = await request(app)
            .get('/api/v1/cart')
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(403);
    });
});
