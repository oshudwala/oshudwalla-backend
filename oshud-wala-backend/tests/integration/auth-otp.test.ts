import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/config/prisma';
import { redisConnection } from '../../src/config/redis';

jest.setTimeout(180000);

describe('Patient Registration & Login with APITXT OTP', () => {
    const patientPhone = '5555555691';
    const ratePhone = '5555555692';
    const adminPhone = '5555555693';
    const password = 'Password123!';
    let regOtp = '';
    let loginOtp = '';

    const cleanup = async () => {
        await prisma.user.deleteMany({ where: { phone: { in: [patientPhone, ratePhone, adminPhone] } } });
        await redisConnection.del(
            `otp:reg:${patientPhone}`, `otp:rate:reg:${patientPhone}`,
            `otp:login:${patientPhone}`, `otp:rate:login:${patientPhone}`,
            `otp:reg:${ratePhone}`, `otp:rate:reg:${ratePhone}`,
            `otp:login:${adminPhone}`, `otp:rate:login:${adminPhone}`
        );
    };

    beforeAll(async () => {
        await cleanup();
        // Create a SUPER_ADMIN user to verify non-patients cannot use OTP login
        await request(app).post('/api/v1/auth/register').send({ fullName: 'Test OTP Admin', phone: adminPhone, password });
        const superAdminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'SUPER_ADMIN' } });
        await prisma.user.update({ where: { phone: adminPhone }, data: { roleId: superAdminRole.id } });
    });

    afterAll(async () => {
        await cleanup();
    });

    it('1. Send registration OTP to new patient phone (200)', async () => {
        const res = await request(app).post('/api/v1/auth/send-otp').send({ phone: patientPhone });
        expect(res.status).toBe(200);
        expect(res.body.data.testOtp).toMatch(/^\d{6}$/);
        regOtp = res.body.data.testOtp;
    });

    it('2. Wrong registration OTP fails with 400', async () => {
        const res = await request(app).post('/api/v1/auth/register-otp').send({
            fullName: 'Test OTP Patient',
            phone: patientPhone,
            password,
            otp: '000000',
        });
        expect(res.status).toBe(400);
    });

    it('3. Valid OTP registers PATIENT with phoneVerifiedAt set (201)', async () => {
        const res = await request(app).post('/api/v1/auth/register-otp').send({
            fullName: 'Test OTP Patient',
            phone: patientPhone,
            password,
            otp: regOtp,
        });
        expect(res.status).toBe(201);
        expect(res.body.data.user.role.name).toBe('PATIENT');
        expect(res.body.data.accessToken).toBeTruthy();

        const user = await prisma.user.findUnique({ where: { phone: patientPhone } });
        expect(user?.phoneVerifiedAt).not.toBeNull();
    });

    it('4. Reusing registration OTP fails with 400', async () => {
        const res = await request(app).post('/api/v1/auth/register-otp').send({
            fullName: 'Reuse Attempt',
            phone: patientPhone,
            password,
            otp: regOtp,
        });
        expect(res.status).toBe(400);
    });

    it('5. Sending registration OTP to existing phone fails with 409', async () => {
        const res = await request(app).post('/api/v1/auth/send-otp').send({ phone: patientPhone });
        expect(res.status).toBe(409);
    });

    it('6. Patient requests Login OTP (200)', async () => {
        const res = await request(app).post('/api/v1/auth/login-otp/send').send({ phone: patientPhone });
        expect(res.status).toBe(200);
        expect(res.body.data.testOtp).toMatch(/^\d{6}$/);
        loginOtp = res.body.data.testOtp;
    });

    it('7. Patient logs in with valid Login OTP (200) and gets tokens', async () => {
        const res = await request(app).post('/api/v1/auth/login-otp/verify').send({ phone: patientPhone, otp: loginOtp });
        expect(res.status).toBe(200);
        expect(res.body.data.user.role).toBe('PATIENT');
        expect(res.body.data.accessToken).toBeTruthy();
        expect(res.body.data.refreshToken).toBeTruthy();
    });

    it('8. Non-patient (SUPER_ADMIN) CANNOT use OTP login (403)', async () => {
        const res = await request(app).post('/api/v1/auth/login-otp/send').send({ phone: adminPhone });
        expect(res.status).toBe(403);
    });

    it('9. Rate limit blocks 4th OTP request within 1 minute (429)', async () => {
        for (let i = 0; i < 3; i++) {
            const r = await request(app).post('/api/v1/auth/send-otp').send({ phone: ratePhone });
            expect(r.status).toBe(200);
        }
        const blocked = await request(app).post('/api/v1/auth/send-otp').send({ phone: ratePhone });
        expect(blocked.status).toBe(429);
    });
});
