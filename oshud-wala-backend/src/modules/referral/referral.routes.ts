import { Router } from 'express';
import { authenticate, authorizeRoles } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import * as c from './referral.controller';
import { applyReferralSchema, rewardReferralSchema } from './referral.validation';

const router = Router();
router.use(authenticate);

router.get('/my', authorizeRoles('PATIENT'), c.getMyReferral);
router.post('/apply', authorizeRoles('PATIENT'), validate(applyReferralSchema), c.applyReferral);
router.post('/:id/reward', authorizeRoles('SUPER_ADMIN'), validate(rewardReferralSchema), c.rewardReferral);

export default router;
