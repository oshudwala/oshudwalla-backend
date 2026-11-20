import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/config/prisma';

jest.setTimeout(180000);

describe('Step 3C: Pharmacy logo, cover, gallery images', () => {
    const adminPhone = '5555555641';
    const patientPhone = '5555555642';
    const owner1Phone = '5555557201';
    const owner2Phone = '5555557202';
    const owner1Email = 'p3c.owner1@test.com';
    const owner2Email = 'p3c.owner2@test.com';
    const password = 'Password123!';
    const fakeUuid = '00000000-0000-4000-8000-000000000000';

    let adminToken = '';
    let patientToken = '';
    let owner1Token = '';
    let ph1Id = '';
    let ph2Id = '';

    const putMedia = (id: string, token: string, body: any) =>
        request(app)
            .put(`/api/v1/pharmacies/${id}/media`)
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
        await prisma.location.deleteMany({ where: { city: 'Test City3C' } });
    };

    beforeAll(async () => {
        await cleanup();

        await request(app).post('/api/v1/auth/register').send({ fullName: 'Test 3C Admin', phone: adminPhone, password });
        const superAdminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'SUPER_ADMIN' } });
        await prisma.user.update({ where: { phone: adminPhone }, data: { roleId: superAdminRole.id } });
        adminToken = (await request(app).post('/api/v1/auth/login').send({ identifier: adminPhone, password })).body.data.accessToken;

        await request(app).post('/api/v1/auth/register').send({ fullName: 'Test 3C Patient', phone: patientPhone, password });
        patientToken = (await request(app).post('/api/v1/auth/login').send({ identifier: patientPhone, password })).body.data.accessToken;

        const loc = await prisma.location.create({
            data: { city: 'Test City3C', area: 'Center', state: 'WB', pincode: '713310', uniqueKey: 'test-city3c-center-713310', isActive: true },
        });

        const res1 = await request(app)
            .post('/api/v1/pharmacies/admin-create')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                name: 'Test P3C Shop1',
                ownerName: 'Test 3C Owner1',
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
                name: 'Test P3C Shop2',
                ownerName: 'Test 3C Owner2',
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

    it('1. Owner updates logoUrl, coverUrl, and galleryUrls (200)', async () => {
        const res = await putMedia(ph1Id, owner1Token, {
            logoUrl: 'https://cdn.oshudwala.com/logo1.png',
            coverUrl: 'https://cdn.oshudwala.com/cover1.jpg',
            galleryUrls: ['https://cdn.oshudwala.com/g1.jpg', 'https://cdn.oshudwala.com/g2.jpg'],
        });
        expect(res.status).toBe(200);
        expect(res.body.data.logoUrl).toBe('https://cdn.oshudwala.com/logo1.png');
        expect(res.body.data.coverUrl).toBe('https://cdn.oshudwala.com/cover1.jpg');
        expect(res.body.data.galleryUrls).toEqual(['https://cdn.oshudwala.com/g1.jpg', 'https://cdn.oshudwala.com/g2.jpg']);
    });

    it('2. Super Admin updates any pharmacy media (200)', async () => {
        const res = await putMedia(ph2Id, adminToken, {
            logoUrl: 'https://cdn.oshudwala.com/logo2.png',
        });
        expect(res.status).toBe(200);
        expect(res.body.data.logoUrl).toBe('https://cdn.oshudwala.com/logo2.png');
    });

    it('3. Owner clears logoUrl and coverUrl with null and empties galleryUrls (200)', async () => {
        const res = await putMedia(ph1Id, owner1Token, {
            logoUrl: null,
            coverUrl: null,
            galleryUrls: [],
        });
        expect(res.status).toBe(200);
        expect(res.body.data.logoUrl).toBeNull();
        expect(res.body.data.coverUrl).toBeNull();
        expect(res.body.data.galleryUrls).toEqual([]);
    });

    it('4. Owner cannot edit another pharmacy media (403)', async () => {
        const res = await putMedia(ph2Id, owner1Token, { logoUrl: 'https://cdn.oshudwala.com/hack.png' });
        expect(res.status).toBe(403);
    });

    it('5. Patient cannot update pharmacy media (403)', async () => {
        const res = await putMedia(ph1Id, patientToken, { logoUrl: 'https://cdn.oshudwala.com/hack.png' });
        expect(res.status).toBe(403);
    });

    it('6. No token returns 401', async () => {
        const res = await request(app)
            .put(`/api/v1/pharmacies/${ph1Id}/media`)
            .send({ logoUrl: 'https://cdn.oshudwala.com/a.png' });
        expect(res.status).toBe(401);
    });

    it('7. Invalid URL returns 400', async () => {
        const res = await putMedia(ph1Id, owner1Token, { logoUrl: 'not-a-url' });
        expect(res.status).toBe(400);
    });

    it('8. Non-http URL (javascript:) returns 400', async () => {
        const res = await putMedia(ph1Id, owner1Token, { coverUrl: 'javascript:alert(1)' });
        expect(res.status).toBe(400);
    });

    it('9. More than 10 galleryUrls returns 400', async () => {
        const urls = Array.from({ length: 11 }, (_, i) => `https://cdn.oshudwala.com/img${i}.jpg`);
        const res = await putMedia(ph1Id, owner1Token, { galleryUrls: urls });
        expect(res.status).toBe(400);
    });

    it('10. Empty body returns 400', async () => {
        const res = await putMedia(ph1Id, owner1Token, {});
        expect(res.status).toBe(400);
    });

    it('11. Unknown pharmacy returns 404', async () => {
        const res = await putMedia(fakeUuid, adminToken, { logoUrl: 'https://cdn.oshudwala.com/x.png' });
        expect(res.status).toBe(404);
    });

    it('12. Audit log has PHARMACY_MEDIA_UPDATED', async () => {
        const log = await prisma.auditLog.findFirst({
            where: { entityId: ph1Id, action: 'PHARMACY_MEDIA_UPDATED' },
            orderBy: { createdAt: 'desc' },
        });
        expect(log).not.toBeNull();
        expect(log?.after).toBeTruthy();
    });
});
