import request from 'supertest';
import app from '../../src/app';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
jest.setTimeout(30000);

describe('User Profile API Automated Tests', () => {
    let testUser = {
        fullName: "Profile Test User",
        phone: "7777777777",
        password: "Password123"
    };
    let accessToken = "";
    let userId = "";

    beforeAll(async () => {
        // Purono data clear kora
        await prisma.user.deleteMany({ where: { phone: testUser.phone } });
        
        // User Register
        await request(app).post('/api/v1/auth/register').send(testUser);
            
        // Login kore Access Token neya
        const res = await request(app)
            .post('/api/v1/auth/login')
            .send({ identifier: testUser.phone, password: testUser.password });
            
        accessToken = res.body.data.accessToken;
        userId = res.body.data.user.id;
    });

    afterAll(async () => {
        // Test er por data clean kora
        await prisma.patientProfile.deleteMany({ where: { userId } });
        await prisma.user.deleteMany({ where: { phone: testUser.phone } });
        await prisma.$disconnect();
    });

    it('should get current user profile', async () => {
        const res = await request(app)
            .get('/api/v1/users/profile')
            .set('Authorization', `Bearer ${accessToken}`);
        
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.phone).toBe(testUser.phone);
        expect(res.body.data.fullName).toBe(testUser.fullName);
    });

    it('should update user and patient profile', async () => {
        const updatePayload = {
            fullName: "Updated Test User",
            email: "test@oshudwala.com",
            dateOfBirth: "1995-01-01T00:00:00.000Z",
            gender: "MALE",
            bloodGroup: "B+",
            allergies: "Peanuts"
        };

        const res = await request(app)
            .put('/api/v1/users/profile')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(updatePayload);
        
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.fullName).toBe("Updated Test User");
        expect(res.body.data.email).toBe("test@oshudwala.com");
        expect(res.body.data.patientProfile.bloodGroup).toBe("B+");
        expect(res.body.data.patientProfile.allergies).toBe("Peanuts");
    });

    // Address testing er jonno id gulo store korar variable
    let addressId1 = "";
    let addressId2 = "";

    it('should add a new address and auto-set as default', async () => {
        const res = await request(app)
            .post('/api/v1/users/addresses')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                label: "Home Test",
                fullName: "Test User",
                phone: "9999999999",
                line1: "123 Test St",
                city: "Test City",
                state: "WB",
                pincode: "700001"
            });
        
        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.isDefault).toBe(true); // First address auto default hobe
        addressId1 = res.body.data.id;
    });

    it('should add a second address and make it default', async () => {
        const res = await request(app)
            .post('/api/v1/users/addresses')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                label: "Office Test",
                fullName: "Test User",
                phone: "9999999999",
                line1: "456 Work Ave",
                city: "Test City",
                state: "WB",
                pincode: "700002",
                isDefault: true // Explicitly default korlam
            });
        
        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.isDefault).toBe(true);
        addressId2 = res.body.data.id;
    });

    it('should fetch all active addresses sorted by default', async () => {
        const res = await request(app)
            .get('/api/v1/users/addresses')
            .set('Authorization', `Bearer ${accessToken}`);
        
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.length).toBe(2);
        
        // Database query te orderBy: { isDefault: 'desc' } kora ache, tai 2nd ta upore asbe
        expect(res.body.data[0].id).toBe(addressId2);
        expect(res.body.data[0].isDefault).toBe(true);
        
        // 1st address ta automatically false hoye gache karon 2nd ta default kora hoyeche
        expect(res.body.data[1].id).toBe(addressId1);
        expect(res.body.data[1].isDefault).toBe(false); 
    });

    it('should soft delete an address', async () => {
        const res = await request(app)
            .delete(`/api/v1/users/addresses/${addressId1}`)
            .set('Authorization', `Bearer ${accessToken}`);
        
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        
        // Abar fetch kore dekhi deleted address ta ar asche kina
        const fetchRes = await request(app)
            .get('/api/v1/users/addresses')
            .set('Authorization', `Bearer ${accessToken}`);
        
        expect(fetchRes.body.data.length).toBe(1); // Ekhon sudhu 1 tai thakbe
    });
});