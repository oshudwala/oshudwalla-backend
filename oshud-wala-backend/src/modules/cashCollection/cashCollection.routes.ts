import { Router } from 'express';
import { authenticate, authorizeRoles } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import * as c from './cashCollection.controller';
import { submitDepositSchema, verifyDepositSchema } from './cashCollection.validation';

const router = Router();

router.use(authenticate);

router.get('/my', authorizeRoles('RIDER'), c.getMyCash);
router.get('/deposits', authorizeRoles('SUPER_ADMIN'), c.listDeposits);
router.get('/admin/riders', authorizeRoles('SUPER_ADMIN'), c.listRiderCashSummaries);
router.post('/deposits', authorizeRoles('RIDER'), validate(submitDepositSchema), c.submitDeposit);
router.patch('/deposits/:id/verify', authorizeRoles('SUPER_ADMIN'), validate(verifyDepositSchema), c.verifyDeposit);

export default router;
