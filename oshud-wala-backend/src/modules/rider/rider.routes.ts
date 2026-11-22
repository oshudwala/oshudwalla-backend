import { Router } from 'express';
import { authenticate, authorizeRoles } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import * as c from './rider.controller';
import { createRiderSchema, updateRiderStatusSchema } from './rider.validation';

const router = Router();

router.use(authenticate, authorizeRoles('SUPER_ADMIN'));

router.post('/admin-create', validate(createRiderSchema), c.createRider);
router.get('/', c.listRiders);
router.patch('/:userId/status', validate(updateRiderStatusSchema), c.updateRiderStatus);

export default router;
