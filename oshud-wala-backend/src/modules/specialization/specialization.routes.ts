import { Router } from 'express';
import { createSpecialization, getSpecializations } from './specialization.controller';
import { validate } from '../../middlewares/validate.middleware';
import { createSpecializationSchema } from './specialization.validation';
import { authenticate, authorizeRoles } from '../../middlewares/auth.middleware';

const router = Router();

// Dropdown-e dekhanor jonno shobai fetch korte parbe
router.get('/', authenticate, getSpecializations);

// SUDHU SUPER_ADMIN notun specialization toiri korte parbe
router.post('/', authenticate, authorizeRoles('SUPER_ADMIN'), validate(createSpecializationSchema), createSpecialization);

export default router;