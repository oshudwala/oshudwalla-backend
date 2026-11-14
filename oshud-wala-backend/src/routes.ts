import { Router } from 'express';
import authRoutes from './modules/auth/auth.routes';
import notificationRoutes from './modules/notification/notification.routes';
import userRoutes from './modules/user/user.routes'; 
import adminRoutes from './modules/admin/admin.routes';
import establishmentRoutes from './modules/establishment/establishment.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/notifications', notificationRoutes); // notification
router.use('/users', userRoutes); //  patient
router.use('/admin', adminRoutes); // admin
router.use('/establishments', establishmentRoutes); // establisment mean dokan

export default router;