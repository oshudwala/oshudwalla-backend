import { Router } from 'express';
import { createNewPharmacy, makePharmacyPrimary, getPharmacies, getPrimaryPharmacy, getMyPharmacies, updatePharmacyProfile, adminUpdatePharmacy, updatePharmacyMedia, updatePharmacyServices, getPharmacyHours, updatePharmacyHours, addPharmacyHoliday, removePharmacyHoliday, createReceptionist, getReceptionists, updateReceptionistStatus, deletePharmacy } from './pharmacy.controller';
import { validate } from '../../middlewares/validate.middleware';
import { autoUpload } from '../../middlewares/autoUpload.middleware';
import { createPharmacySchema, updatePharmacySchema, adminUpdatePharmacySchema, updatePharmacyMediaSchema, updatePharmacyServicesSchema, getPharmacyHoursSchema, updatePharmacyHoursSchema, addPharmacyHolidaySchema, removePharmacyHolidaySchema, createReceptionistSchema, listReceptionistsSchema, updateReceptionistStatusSchema } from './pharmacy.validation';
import { authenticate, authorizeRoles } from '../../middlewares/auth.middleware';

const router = Router();

// Public: Users can see this list to browse and select clinics/pharmacies
router.get('/', getPharmacies);
router.get('/primary', getPrimaryPharmacy);
router.get('/:id/hours', validate(getPharmacyHoursSchema), getPharmacyHours);

// Protected routes below
router.use(authenticate);

// PHARMACY owner: only the pharmacies linked to me (declared before any '/:id' route)
router.get('/my', authorizeRoles('PHARMACY', 'RECEPTIONIST'), getMyPharmacies);

// SUPER_ADMIN ONLY ROUTES
router.post('/admin-create', authorizeRoles('SUPER_ADMIN'), autoUpload({ folder: 'pharmacies', targetBodyKey: 'logoUrl', nameFromBody: 'name' }), validate(createPharmacySchema), createNewPharmacy);
router.put('/admin-primary/:id', authorizeRoles('SUPER_ADMIN'), makePharmacyPrimary);
router.patch('/:id/primary', authorizeRoles('SUPER_ADMIN'), makePharmacyPrimary);
router.put('/admin-update/:id', authorizeRoles('SUPER_ADMIN'), validate(adminUpdatePharmacySchema), adminUpdatePharmacy);
router.delete('/admin-delete/:id', authorizeRoles('SUPER_ADMIN'), deletePharmacy);
router.delete('/:id', authorizeRoles('SUPER_ADMIN'), deletePharmacy);

// SUPER_ADMIN (any pharmacy) or PHARMACY owner (own pharmacy only, checked in the service)
router.put('/:id/media', authorizeRoles('SUPER_ADMIN', 'PHARMACY'), validate(updatePharmacyMediaSchema), updatePharmacyMedia);
router.put('/:id/services', authorizeRoles('SUPER_ADMIN'), validate(updatePharmacyServicesSchema), updatePharmacyServices);
router.put('/:id/hours', authorizeRoles('SUPER_ADMIN', 'PHARMACY'), validate(updatePharmacyHoursSchema), updatePharmacyHours);
router.post('/:id/holidays', authorizeRoles('SUPER_ADMIN', 'PHARMACY'), validate(addPharmacyHolidaySchema), addPharmacyHoliday);
router.delete('/:id/holidays/:holidayId', authorizeRoles('SUPER_ADMIN', 'PHARMACY'), validate(removePharmacyHolidaySchema), removePharmacyHoliday);
router.post('/:id/receptionists', authorizeRoles('SUPER_ADMIN', 'PHARMACY'), validate(createReceptionistSchema), createReceptionist);
router.get('/:id/receptionists', authorizeRoles('SUPER_ADMIN', 'PHARMACY'), validate(listReceptionistsSchema), getReceptionists);
router.patch('/:id/receptionists/:staffId/status', authorizeRoles('SUPER_ADMIN', 'PHARMACY'), validate(updateReceptionistStatusSchema), updateReceptionistStatus);
router.put('/:id', authorizeRoles('SUPER_ADMIN', 'PHARMACY'), autoUpload({ folder: 'pharmacies', targetBodyKey: 'logoUrl', nameFromBody: 'name' }), validate(updatePharmacySchema), updatePharmacyProfile);

export default router;
