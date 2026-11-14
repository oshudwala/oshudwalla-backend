import request from 'supertest';
import app from '../../src/app';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
jest.setTimeout(30000); // 30 seconds timeout

describe('Notification API Automated Tests', () => {
    let testUser = {
        fullName: "Notif Test User",
        phone: "8888888888",
        password: "Password123"
    };
    let accessToken = "";
    const testFcmToken = "jest_test_fcm_token_999";

    beforeAll(async () => {
        // Purono data clear kora
        await prisma.user.deleteMany({ where: { phone: testUser.phone } });
        
        // User Register
        await request(app)
            .post('/api/v1/auth/register')
            .send(testUser);
            
        // User Login kore Access Token neya
        const res = await request(app)
            .post('/api/v1/auth/login')
            .send({ identifier: testUser.phone, password: testUser.password });
            
        accessToken = res.body.data.accessToken;
    });

    afterAll(async () => {
        // Test er por data clean kora
        await prisma.deviceToken.deleteMany({ where: { token: testFcmToken } });
        await prisma.user.deleteMany({ where: { phone: testUser.phone } });
        await prisma.$disconnect();
    });

    it('should register a device token successfully', async () => {
        const res = await request(app)
            .post('/api/v1/notifications/device-token')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                fcmToken: testFcmToken,
                deviceType: "ANDROID",
                deviceId: "jest_device_1"
            });
        
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.tokenRecord.token).toBe(testFcmToken);
        expect(res.body.data.tokenRecord.platform).toBe("ANDROID");
    });

    it('should fail to register without deviceType', async () => {
        const res = await request(app)
            .post('/api/v1/notifications/device-token')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                fcmToken: "some_token"
            });
        
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });

    it('should remove a device token successfully', async () => {
        const res = await request(app)
            .post('/api/v1/notifications/device-token/remove')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                fcmToken: testFcmToken
            });
        
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toBe("Device token removed successfully");
    });
});