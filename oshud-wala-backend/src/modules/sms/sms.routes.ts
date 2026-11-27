import { Router } from 'express';
import { authenticate, authorizeRoles } from '../../middlewares/auth.middleware';
import { checkSmsBalance } from './sms.controller';

const router = Router();

router.get('/balance', authenticate, authorizeRoles('SUPER_ADMIN'), checkSmsBalance);
router.post('/balance', authenticate, authorizeRoles('SUPER_ADMIN'), checkSmsBalance);

export default router;