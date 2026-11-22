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
import appointmentRoutes from './modules/appointment/appointment.routes';
import categoryRoutes from './modules/category/category.routes';
import productRoutes from './modules/product/product.routes';
import cartRoutes from './modules/cart/cart.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/notifications', notificationRoutes);
router.use('/users', userRoutes);
router.use('/admin', adminRoutes);
router.use('/specializations', specializationRoutes);
router.use('/doctors', doctorRoutes);
router.use('/pharmacies', pharmacyRoutes);
router.use('/locations', locationRoutes);
router.use('/schedules', scheduleRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/categories', categoryRoutes);
router.use('/products', productRoutes);
router.use('/cart', cartRoutes);

export default router;
