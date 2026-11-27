import { Router } from 'express';
import { authenticate, authorizeRoles } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import * as c from './wallet.controller';
import { requestWithdrawalSchema, reviewWithdrawalSchema } from './wallet.validation';

const router = Router();

router.use(authenticate);

router.get('/my', authorizeRoles('RIDER', 'PATIENT', 'PHARMACY'), c.getMyWallet);
router.post('/withdrawals', authorizeRoles('RIDER', 'PATIENT', 'PHARMACY'), validate(requestWithdrawalSchema), c.requestWithdrawal);
router.get('/withdrawals', authorizeRoles('SUPER_ADMIN', 'RIDER', 'PATIENT', 'PHARMACY'), c.listWithdrawals);
router.patch('/withdrawals/:id/review', authorizeRoles('SUPER_ADMIN'), validate(reviewWithdrawalSchema), c.reviewWithdrawal);
router.get('/admin/overview', authorizeRoles('SUPER_ADMIN'), c.getAdminFinanceOverview);
router.post('/admin/disburse', authorizeRoles('SUPER_ADMIN'), c.adminDisburseToRider);

export default router;
