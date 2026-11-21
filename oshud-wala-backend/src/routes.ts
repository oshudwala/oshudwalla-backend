import { Router } from 'express';
import authRoutes from './modules/auth/auth.routes';
import notificationRoutes from './modules/notification/notification.routes';
import userRoutes from './modules/user/user.routes'; 
import adminRoutes from './modules/admin/admin.routes';
import specializationRoutes from './modules/specialization/specialization.routes';
import doctorRoutes from './modules/doctor/doctor.routes';
import pharmacyRoutes from './modules/pharmacy/pharmacy.routes';
import locationRoutes from './modules/location/location.routes';
import scheduleRoutes from './modules/schedule/schedule.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/notifications', notificationRoutes); // notification
router.use('/users', userRoutes); //  patient
router.use('/admin', adminRoutes); // admin
router.use('/specializations', specializationRoutes); // specilagiaction
router.use('/doctors', doctorRoutes); // doctors
router.use('/pharmacies', pharmacyRoutes);
router.use('/locations', locationRoutes);
router.use('/schedules', scheduleRoutes);

export default router;