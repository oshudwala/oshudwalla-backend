import { Router } from 'express';
import authRoutes from './modules/auth/auth.routes';
import notificationRoutes from './modules/notification/notification.routes';

const router = Router();

router.use('/auth', authRoutes);

router.use('/notifications', notificationRoutes);


export default router;