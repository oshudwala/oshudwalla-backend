import { Router } from 'express';
import { createNewPharmacy, makePharmacyPrimary, getPharmacies, getMyPharmacies, updatePharmacyProfile } from './pharmacy.controller';
import { validate } from '../../middlewares/validate.middleware';
import { createPharmacySchema, updatePharmacySchema } from './pharmacy.validation';
import { authenticate, authorizeRoles } from '../../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

// Logged-in users can see this list to select a pharmacy
router.get('/', getPharmacies);

// PHARMACY owner: only the pharmacies linked to me (declared before any '/:id' route)
router.get('/my', authorizeRoles('PHARMACY'), getMyPharmacies);

// SUPER_ADMIN ONLY ROUTES
router.post('/admin-create', authorizeRoles('SUPER_ADMIN'), validate(createPharmacySchema), createNewPharmacy);
router.put('/admin-primary/:id', authorizeRoles('SUPER_ADMIN'), makePharmacyPrimary);

// SUPER_ADMIN (any pharmacy) or PHARMACY owner (own pharmacy only, checked in the service)
router.put('/:id', authorizeRoles('SUPER_ADMIN', 'PHARMACY'), validate(updatePharmacySchema), updatePharmacyProfile);

export default router;
