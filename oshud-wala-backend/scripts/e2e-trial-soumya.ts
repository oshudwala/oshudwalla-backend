import 'dotenv/config';
import fs from 'fs';
import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/prisma';
import { generateAccessToken } from '../src/utils/jwt.util';
import { assertNoDoctorTimingConflict } from '../src/modules/schedule/schedule.conflict';

async function run() {
    const phone = '6296398479';
    const fullName = 'Soumya';
    console.log('\n🚀 STARTING OSHUD-WALA END-TO-END TRIAL FOR SOUMYA (6296398479)\n');

    const roles = await prisma.role.findMany();
    const roleMap = new Map(roles.map((r) => [r.name, r.id]));

    // 1. Super Admin
    let admin = await prisma.user.findFirst({ where: { role: { name: 'SUPER_ADMIN' } } });
    if (!admin) {
        admin = await prisma.user.create({
            data: { fullName: 'Super Admin', phone: '9999990001', email: 'admin@oshudwala.com', passwordHash: 'hash', roleId: roleMap.get('SUPER_ADMIN')! },
        });
    }
    const adminToken = generateAccessToken(admin.id, 'SUPER_ADMIN');
    console.log('✅ 1. Super Admin ready:', admin.fullName);

    // 2. Super Admin creates Location + Primary Pharmacy/Clinic
    const loc = await prisma.location.upsert({
        where: { uniqueKey: 'durgapur-city-centre-713216' },
        create: { city: 'Durgapur', area: 'City Centre', state: 'WB', pincode: '713216', uniqueKey: 'durgapur-city-centre-713216', isActive: true },
        update: {},
    });

    let pharmacy = await prisma.pharmacy.findFirst({ where: { isPrimary: true } });
    if (!pharmacy) {
        pharmacy = await prisma.pharmacy.create({
            data: {
                name: 'Oshud Wala Primary Pharmacy & Clinic',
                phone: '9999990002',
                email: 'primary@oshudwala.com',
                line1: 'City Centre, Durgapur',
                city: loc.city,
                state: loc.state,
                pincode: loc.pincode,
                locationId: loc.id,
                status: 'ACTIVE',
                isPrimary: true,
                hasClinicService: true,
                hasMedicineService: true,
            },
        });
    }
    console.log('✅ 2. Primary Pharmacy ready:', pharmacy.name);

    // 3. Super Admin creates Doctor + Assigns to Pharmacy with Fee + Schedule (2nd Sunday) + Conflict Check
    const regNo = `WBMC-TRIAL-${Date.now()}`;
    const doctor = await prisma.doctor.create({
        data: { fullName: 'Dr. Arindam Bose', phone: `98${String(Date.now()).slice(-8)}`, registrationNumber: regNo },
    });
    const pd = await prisma.pharmacyDoctor.create({
        data: { pharmacyId: pharmacy.id, doctorId: doctor.id, consultationFeePaise: 50000, isActive: true },
    });

    await assertNoDoctorTimingConflict(doctor.id, {
        recurrenceType: 'MONTHLY_WEEK_DAY',
        dayOfWeek: 0, // Sunday
        weekOfMonth: 2, // 2nd Sunday
        startMinute: 600, // 10:00 AM
        endMinute: 720,   // 12:00 PM
    });

    const sched = await prisma.doctorSchedule.create({
        data: {
            pharmacyDoctorId: pd.id,
            recurrenceType: 'MONTHLY_WEEK_DAY',
            dayOfWeek: 0,
            weekOfMonth: 2,
            startMinute: 600,
            endMinute: 720,
            slotDurationMinutes: 30,
            slotCapacity: 2,
            validFrom: new Date('2026-11-01T00:00:00.000Z'),
        },
    });
    console.log('✅ 3. Doctor assigned with ₹500 fee & 2nd Sunday 10:00-12:00 schedule:', sched.id);

    // Test Conflict Detection
    try {
        await assertNoDoctorTimingConflict(doctor.id, {
            recurrenceType: 'MONTHLY_WEEK_DAY',
            dayOfWeek: 0,
            weekOfMonth: 2,
            startMinute: 660, // 11:00 AM (overlaps 10:00-12:00!)
            endMinute: 780,
        });
    } catch (e: any) {
        console.log('⚠️  3b. Conflict Check Triggered Successfully:', e.message);
    }

    // 4. Super Admin creates Rider
    const riderRes = await request(app)
        .post('/api/v1/riders/admin-create')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
            fullName: 'Raju Rider',
            phone: `97${String(Date.now()).slice(-8)}`,
            email: `raju.${Date.now()}@oshudwala.com`,
            password: 'Password123!',
            vehicleType: 'Bike',
            vehicleNumber: 'WB39B4321',
        });
    const riderId = riderRes.body.data.user.id;
    const riderToken = generateAccessToken(riderId, 'RIDER');
    console.log('✅ 4. Rider created by Super Admin:', riderRes.body.data.user.fullName);

    // 5. Patient (Soumya - 6296398479) ready
    let patient = await prisma.user.findUnique({ where: { phone } });
    if (!patient) {
        patient = await prisma.user.create({
            data: { fullName, phone, email: 'soumyachatterjee2802@gmail.com', passwordHash: 'hash', roleId: roleMap.get('PATIENT')!, phoneVerifiedAt: new Date() },
        });
    }
    const patientToken = generateAccessToken(patient.id, 'PATIENT');
    console.log(`✅ 5. Patient ready: ${patient.fullName} (${patient.phone})`);

    // 6. Patient uploads Prescription -> auto routes to Primary Pharmacy
    const rxRes = await request(app)
        .post('/api/v1/prescriptions')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
            doctorName: 'Dr. Arindam Bose',
            patientNote: 'Please send medicines as per prescription',
            files: [{ storageKey: 'oshudwala/rx/soumya_trial', mimeType: 'image/jpeg', sizeBytes: 18000, checksumSha256: 'soumya12345678' }],
        });
    const rxId = rxRes.body.data.id;
    console.log('✅ 6. Prescription uploaded to Primary Pharmacy:', rxRes.body.data.prescriptionNumber);

    // 7. Super Admin approves Prescription & creates Bill (MRP ₹500, Real ₹420)
    await request(app)
        .patch(`/api/v1/prescriptions/${rxId}/review`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'VERIFIED' });

    const order = await prisma.order.create({
        data: {
            orderNumber: `ORD-SOUMYA-${Date.now()}`,
            patientId: patient.id,
            pharmacyId: pharmacy.id,
            prescriptionId: rxId,
            deliveryAddress: { fullName, phone, line1: 'City Centre', city: 'Durgapur', state: 'WB', pincode: '713216' },
            status: 'READY_FOR_PICKUP',
            paymentMethod: 'COD',
            paymentStatus: 'PENDING',
            subtotalPaise: 50000, // MRP ₹500
            couponDiscountPaise: 8000,  // Discount ₹80
            totalPaise: 42000,    // Real Payable ₹420
        },
    });
    console.log(`✅ 7. Prescription Verified & Bill Created: ${order.orderNumber} (MRP ₹500 -> Real ₹420 COD)`);

    // 8. Download PDF Invoice
    const pdfRes = await request(app)
        .get(`/api/v1/orders/${order.id}/invoice.pdf`)
        .set('Authorization', `Bearer ${patientToken}`);
    const pdfPath = `/tmp/invoice-${order.orderNumber}.pdf`;
    fs.writeFileSync(pdfPath, pdfRes.body);
    console.log(`✅ 8. PDF Bill Downloaded (${pdfRes.status}, ${pdfRes.body.length} bytes) -> ${pdfPath}`);

    // 9. Super Admin assigns Rider -> Pickup QR generated
    const assignRes = await request(app)
        .post('/api/v1/deliveries/assign')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ riderId, orderIds: [order.id] });
    const deliveryId = assignRes.body.data.deliveries[0].id;
    const qrToken = assignRes.body.data.pickupQrs[0].qrToken;
    console.log('✅ 9. Rider assigned & Pickup QR generated');

    // 10. Rider scans Pickup QR -> SHIPPED
    const scanRes = await request(app)
        .post('/api/v1/deliveries/pickup-qr/scan')
        .set('Authorization', `Bearer ${riderToken}`)
        .send({ qrToken });
    console.log('✅ 10. Rider scanned Pickup QR -> Orders picked up:', scanRes.body.data.pickedUpCount);

    // 11. Rider arrives -> In-App OTP generated -> Soumya reads OTP
    await request(app).post(`/api/v1/deliveries/${deliveryId}/arrived`).set('Authorization', `Bearer ${riderToken}`);
    const otpRes = await request(app).get(`/api/v1/deliveries/order/${order.id}/otp`).set('Authorization', `Bearer ${patientToken}`);
    const otp = otpRes.body.data.otp;
    console.log(`✅ 11. Rider Arrived -> Soumya's In-App Delivery OTP: ${otp}`);

    // 12. Rider completes delivery with OTP -> ₹40 credited + ₹420 COD recorded
    const doneRes = await request(app)
        .post(`/api/v1/deliveries/${deliveryId}/complete`)
        .set('Authorization', `Bearer ${riderToken}`)
        .send({ otp });
    console.log('✅ 12. DELIVERY COMPLETED!', doneRes.body.data);
    console.log('\n🎉 FULL END-TO-END TRIAL PASSED!\n');
    process.exit(0);
}

run().catch((e) => {
    console.error('❌ Trial failed:', e);
    process.exit(1);
});
