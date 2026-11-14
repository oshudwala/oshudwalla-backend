import { Router } from 'express';
import { adminCreateEstablishment, adminMakePrimary, getPublicEstablishments } from './establishment.controller';
import { validate } from '../../middlewares/validate.middleware';
import { createEstablishmentByAdminSchema } from './establishment.validation';
import { authenticate, authorizeRoles } from '../../middlewares/auth.middleware';

const router = Router();

// Public / Authenticated Route (Shob user ra dekhte pabe)
router.get('/', authenticate, getPublicEstablishments);

// SUPER ADMIN ONLY ROUTES (Sudhu Super Admin ei token diye toiri korte parbe)
router.post('/admin-create', authenticate, authorizeRoles('SUPER_ADMIN'), validate(createEstablishmentByAdminSchema), adminCreateEstablishment);
router.put('/admin-primary/:id', authenticate, authorizeRoles('SUPER_ADMIN'), adminMakePrimary);

export default router;