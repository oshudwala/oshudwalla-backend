import { Router } from 'express';
import { authenticate, authorizeRoles } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import * as c from './coupon.controller';
import { createCouponSchema, validateCouponSchema, updateCouponStatusSchema } from './coupon.validation';

const router = Router();
router.use(authenticate);

router.get('/', c.listCoupons);
router.post('/', authorizeRoles('SUPER_ADMIN'), validate(createCouponSchema), c.createCoupon);
router.post('/validate', authorizeRoles('PATIENT'), validate(validateCouponSchema), c.validateCoupon);
router.patch('/:id/status', authorizeRoles('SUPER_ADMIN'), validate(updateCouponStatusSchema), c.updateCouponStatus);

export default router;
