import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/config/prisma';

jest.setTimeout(120000);

describe('Step 3B: Bengali and Hindi pharmacy name', () => {
    const admin = { fullName: 'P3B Admin', phone: '5555555611', password: 'Password123' };
    const bn = 'ঔষধ ওয়ালা ফার্মেসি';
    const hi = 'औषध वाला फार्मेसी';
    const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

    let adminToken = '', locId = '';
    let n = 0;
    let withNames: any = null;
    let withNamesBody: any = null;

    const body = (over: any = {}) => {
        n++;
        return {
            name: `Test P3B Pharmacy ${n}`,
            ownerName: 'Test P3B Owner',
            ownerEmail: `p3b.owner${n}@example.com`,
            ownerPassword: 'Password123',
            phone: `55555567${String(n).padStart(2, '0')}`,
            locationId: locId,
            line1: 'Main Road',
            ...over,
        };
    };
    const create = (b: any) => request(app).post('/api/v1/pharmacies/admin-create').set(auth(adminToken)).send(b);

    const cleanup = async () => {
        await prisma.pharmacy.deleteMany({ where: { name: { startsWith: 'Test P3B' } } });
        await prisma.location.deleteMany({ where: { city: { startsWith: 'Test P3B' } } });
        const users = await prisma.user.findMany({
            where: { OR: [{ phone: admin.phone }, { phone: { startsWith: '55555567' } }, { email: { startsWith: 'p3b.' } }] },
            select: { id: true },
        });
        const ids = users.map((u) => u.id);
        if (ids.length) {
            try { await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } }); } catch {}
            await prisma.user.deleteMany({ where: { id: { in: ids } } });
        }
    };

    beforeAll(async () => {
        await cleanup();
        await request(app).post('/api/v1/auth/register').send(admin);
        const role = await prisma.role.upsert({ where: { name: 'SUPER_ADMIN' }, update: {}, create: { name: 'SUPER_ADMIN' } });
        await prisma.user.update({ where: { phone: admin.phone }, data: { roleId: role.id } });
        const login = await request(app).post('/api/v1/auth/login').send({ identifier: admin.phone, password: admin.password });
        adminToken = login.body.data.accessToken;
        const loc = await request(app).post('/api/v1/locations').set(auth(adminToken))
            .send({ city: 'Test P3B City', area: 'Centre', state: 'West Bengal', pincode: '713216' });
        locId = loc.body.data.id;
    });

    afterAll(async () => {
        await cleanup();
        await prisma.$disconnect();
    });

    it('1. create with Bengali and Hindi names (201), saved exactly', async () => {
        withNamesBody = body({ nameBn: bn, nameHi: hi });
        const res = await create(withNamesBody);
        expect(res.status).toBe(201);
        withNames = res.body.data;
        expect(withNames.nameBn).toBe(bn);
        expect(withNames.nameHi).toBe(hi);
        const row = await prisma.pharmacy.findUnique({ where: { id: withNames.id } });
        expect(row?.nameBn).toBe(bn);
        expect(row?.nameHi).toBe(hi);
    });

    it('2. create without names (201), both are null', async () => {
        const res = await create(body());
        expect(res.status).toBe(201);
        expect(res.body.data.nameBn).toBeNull();
        expect(res.body.data.nameHi).toBeNull();
    });

    it('3. explicit null names (201)', async () => {
        const res = await create(body({ nameBn: null, nameHi: null }));
        expect(res.status).toBe(201);
        expect(res.body.data.nameBn).toBeNull();
    });

    it('4. owner sees the names on /my (200)', async () => {
        const login = await request(app).post('/api/v1/auth/login').send({ identifier: withNamesBody.ownerEmail, password: withNamesBody.ownerPassword });
        expect(login.status).toBe(200);
        const res = await request(app).get('/api/v1/pharmacies/my').set(auth(login.body.data.accessToken));
        expect(res.status).toBe(200);
        expect(res.body.data[0].nameBn).toBe(bn);
        expect(res.body.data[0].nameHi).toBe(hi);
    });

    it('5. pharmacy list shows the names (200)', async () => {
        const res = await request(app).get('/api/v1/pharmacies').set(auth(adminToken));
        expect(res.status).toBe(200);
        const found = res.body.data.find((p: any) => p.id === withNames.id);
        expect(found.nameBn).toBe(bn);
        expect(found.nameHi).toBe(hi);
    });

    it('6. one-letter Bengali name (400)', async () => {
        const res = await create(body({ nameBn: 'অ' }));
        expect(res.status).toBe(400);
    });

    it('7. Hindi name longer than 100 characters (400)', async () => {
        const res = await create(body({ nameHi: 'क'.repeat(101) }));
        expect(res.status).toBe(400);
    });
});
