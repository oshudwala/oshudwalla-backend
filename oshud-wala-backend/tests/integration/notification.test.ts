import request from 'supertest';
import app from '../../src/app';
import { PrismaClient } from '@prisma/client';
import { redisConnection } from '../../src/config/redis';

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
        await redisConnection.quit(); // <--- Redis bondho korar jnno eta must
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
    it('should get default notification preferences', async () => {
        const res = await request(app)
            .get('/api/v1/notifications/preferences')
            .set('Authorization', `Bearer ${accessToken}`);
        
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.globalSettings).toBeDefined();
        expect(res.body.data.globalSettings.pushEnabled).toBe(true);
        expect(res.body.data.categories).toBeInstanceOf(Array);
    });

    it('should update notification preferences', async () => {
        const updatePayload = {
            globalSettings: {
                pushEnabled: true,
                quietStartMinute: 1320,
                quietEndMinute: 420,
                timezone: "Asia/Kolkata"
            },
            categories: [
                {
                    category: "ORDER",
                    pushEnabled: true,
                    inAppEnabled: true
                },
                {
                    category: "APPOINTMENT",
                    pushEnabled: true,
                    inAppEnabled: false
                }
            ]
        };

        const res = await request(app)
            .put('/api/v1/notifications/preferences')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(updatePayload);
        
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.globalSettings.quietStartMinute).toBe(1320);
        expect(res.body.data.categories.length).toBe(2);
        
        const orderPref = res.body.data.categories.find((c: any) => c.category === 'ORDER');
        expect(orderPref.pushEnabled).toBe(true);
        
        const apptPref = res.body.data.categories.find((c: any) => c.category === 'APPOINTMENT');
        expect(apptPref.inAppEnabled).toBe(false);
    });

    it('should enqueue a test push notification job', async () => {
        const res = await request(app)
            .post('/api/v1/notifications/test-push')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                title: "Jest Queue Test",
                body: "Testing BullMQ integration"
            });
        
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toBe("Push notification job enqueued successfully");
    });

});