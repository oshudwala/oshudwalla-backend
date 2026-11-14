import { Router } from 'express';
import { getUsersList, updateUserAccess, getSettings, setSetting } from './admin.controller';
import { validate } from '../../middlewares/validate.middleware';
import { updateUserAccessSchema, platformSettingSchema } from './admin.validation';
import { authenticate, authorizeRoles } from '../../middlewares/auth.middleware';

const router = Router();

// Protect ALL admin routes: Only logged in users AND who have SUPER_ADMIN role can access
router.use(authenticate);
router.use(authorizeRoles('SUPER_ADMIN'));

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Super Admin Control Panel
 */

router.get('/users', getUsersList);
router.put('/users/:id/access', validate(updateUserAccessSchema), updateUserAccess);

router.get('/settings', getSettings);
router.post('/settings', validate(platformSettingSchema), setSetting);

export default router;