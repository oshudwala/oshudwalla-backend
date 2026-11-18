import { Router } from 'express';
import { createNewPharmacy, makePharmacyPrimary, getPharmacies, assignPharmacyOwner, getMyPharmacies } from './pharmacy.controller';
import { validate } from '../../middlewares/validate.middleware';
import { createPharmacySchema, assignOwnerSchema } from './pharmacy.validation';
import { authenticate, authorizeRoles } from '../../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

// Logged-in users can see this list to select a pharmacy
router.get('/', getPharmacies);

// PHARMACY owner: only the pharmacies linked to me
router.get('/my', authorizeRoles('PHARMACY'), getMyPharmacies);

// SUPER_ADMIN ONLY ROUTES
router.post('/admin-create', authorizeRoles('SUPER_ADMIN'), validate(createPharmacySchema), createNewPharmacy);
router.put('/admin-primary/:id', authorizeRoles('SUPER_ADMIN'), makePharmacyPrimary);
router.post('/:id/owner', authorizeRoles('SUPER_ADMIN'), validate(assignOwnerSchema), assignPharmacyOwner);

export default router;
