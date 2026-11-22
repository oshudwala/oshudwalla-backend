import { Router } from 'express';
import { createNewPharmacy, makePharmacyPrimary, getPharmacies, getMyPharmacies, updatePharmacyProfile, adminUpdatePharmacy, updatePharmacyMedia, updatePharmacyServices, getPharmacyHours, updatePharmacyHours, addPharmacyHoliday, removePharmacyHoliday, createReceptionist, getReceptionists, updateReceptionistStatus } from './pharmacy.controller';
import { validate } from '../../middlewares/validate.middleware';
import { createPharmacySchema, updatePharmacySchema, adminUpdatePharmacySchema, updatePharmacyMediaSchema, updatePharmacyServicesSchema, getPharmacyHoursSchema, updatePharmacyHoursSchema, addPharmacyHolidaySchema, removePharmacyHolidaySchema, createReceptionistSchema, listReceptionistsSchema, updateReceptionistStatusSchema } from './pharmacy.validation';
import { authenticate, authorizeRoles } from '../../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

// Logged-in users can see this list to select a pharmacy
router.get('/', getPharmacies);

// PHARMACY owner: only the pharmacies linked to me (declared before any '/:id' route)
router.get('/my', authorizeRoles('PHARMACY', 'RECEPTIONIST'), getMyPharmacies);

// SUPER_ADMIN ONLY ROUTES
router.post('/admin-create', authorizeRoles('SUPER_ADMIN'), validate(createPharmacySchema), createNewPharmacy);
router.put('/admin-primary/:id', authorizeRoles('SUPER_ADMIN'), makePharmacyPrimary);
router.put('/admin-update/:id', authorizeRoles('SUPER_ADMIN'), validate(adminUpdatePharmacySchema), adminUpdatePharmacy);

// SUPER_ADMIN (any pharmacy) or PHARMACY owner (own pharmacy only, checked in the service)
router.put('/:id/media', authorizeRoles('SUPER_ADMIN', 'PHARMACY'), validate(updatePharmacyMediaSchema), updatePharmacyMedia);
router.put('/:id/services', authorizeRoles('SUPER_ADMIN'), validate(updatePharmacyServicesSchema), updatePharmacyServices);
router.get('/:id/hours', validate(getPharmacyHoursSchema), getPharmacyHours);
router.put('/:id/hours', authorizeRoles('SUPER_ADMIN', 'PHARMACY'), validate(updatePharmacyHoursSchema), updatePharmacyHours);
router.post('/:id/holidays', authorizeRoles('SUPER_ADMIN', 'PHARMACY'), validate(addPharmacyHolidaySchema), addPharmacyHoliday);
router.delete('/:id/holidays/:holidayId', authorizeRoles('SUPER_ADMIN', 'PHARMACY'), validate(removePharmacyHolidaySchema), removePharmacyHoliday);
router.post('/:id/receptionists', authorizeRoles('SUPER_ADMIN', 'PHARMACY'), validate(createReceptionistSchema), createReceptionist);
router.get('/:id/receptionists', authorizeRoles('SUPER_ADMIN', 'PHARMACY'), validate(listReceptionistsSchema), getReceptionists);
router.patch('/:id/receptionists/:staffId/status', authorizeRoles('SUPER_ADMIN', 'PHARMACY'), validate(updateReceptionistStatusSchema), updateReceptionistStatus);
router.put('/:id', authorizeRoles('SUPER_ADMIN', 'PHARMACY'), validate(updatePharmacySchema), updatePharmacyProfile);

export default router;
