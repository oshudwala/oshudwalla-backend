import { Router } from 'express';
import { createNewPharmacy, makePharmacyPrimary, getPharmacies } from './pharmacy.controller';
import { validate } from '../../middlewares/validate.middleware';
import { createPharmacySchema } from './pharmacy.validation';
import { authenticate, authorizeRoles } from '../../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

// Publicly viewable active pharmacies (Users can see this list to select a pharmacy)
router.get('/', getPharmacies);

// SUPER_ADMIN ONLY ROUTES
router.post('/admin-create', authorizeRoles('SUPER_ADMIN'), validate(createPharmacySchema), createNewPharmacy);
router.put('/admin-primary/:id', authorizeRoles('SUPER_ADMIN'), makePharmacyPrimary);

export default router;