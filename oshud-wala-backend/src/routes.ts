import { Router } from 'express';
import authRoutes from './modules/auth/auth.routes';
import notificationRoutes from './modules/notification/notification.routes';
import userRoutes from './modules/user/user.routes'; 

const router = Router();

router.use('/auth', authRoutes);
router.use('/notifications', notificationRoutes); // notification
router.use('/users', userRoutes); //  patient

export default router;