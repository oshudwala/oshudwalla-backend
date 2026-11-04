import request from 'supertest';
import app from '../../src/app';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
jest.setTimeout(30000); // 30 seconds timeout add kora holo

describe('Auth API Automated Tests', () => {
    let testUser = {
        fullName: "Auto Test User",
        phone: "9999999999",
        password: "Password123"
    };
    let accessToken = "";
    let sessionId = "";
    let refreshToken = "";

    beforeAll(async () => {
        // Age theke kono half-completed test data thakle clear kore nibe
        await prisma.user.deleteMany({ where: { phone: testUser.phone } });
    });

    afterAll(async () => {
        // Test complete hobar por data clean kore database connection close korbe
        await prisma.user.deleteMany({ where: { phone: testUser.phone } });
        await prisma.$disconnect();
    });

    it('should register a new user successfully', async () => {
        const res = await request(app)
            .post('/api/v1/auth/register')
            .send(testUser);
        
        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        // Ekhane update kora holo: data.user.phone
        expect(res.body.data.user.phone).toBe(testUser.phone);
    });

    it('should login the user and return tokens', async () => {
        const res = await request(app)
            .post('/api/v1/auth/login')
            .send({ identifier: testUser.phone, password: testUser.password });
        
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.accessToken).toBeDefined();
        
        accessToken = res.body.data.accessToken;
        refreshToken = res.body.data.refreshToken;
        sessionId = res.body.data.sessionId;
    });

    it('should fail with invalid credentials', async () => {
        const res = await request(app)
            .post('/api/v1/auth/login')
            .send({ identifier: testUser.phone, password: "wrongpassword" });
        
        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
    });
});