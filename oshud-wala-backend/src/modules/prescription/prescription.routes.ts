import { Router } from 'express';
import { authenticate, authorizeRoles } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { autoUploadPrescriptionFiles } from '../../middlewares/autoUpload.middleware';
import * as c from './prescription.controller';
import { createPrescriptionSchema, reviewPrescriptionSchema, pharmacyParamSchema } from './prescription.validation';

const router = Router();

router.use(authenticate);

router.post('/', authorizeRoles('PATIENT'), autoUploadPrescriptionFiles(), validate(createPrescriptionSchema), c.submitPrescription);
router.post('/upload', authorizeRoles('PATIENT'), autoUploadPrescriptionFiles(), validate(createPrescriptionSchema), c.submitPrescription);
router.get('/', authorizeRoles('SUPER_ADMIN', 'PHARMACY'), c.getPharmacyPrescriptionsForCurrentUser);
router.get('/my', authorizeRoles('PATIENT'), c.getMyPrescriptions);
router.get('/pharmacy/:pharmacyId', authorizeRoles('SUPER_ADMIN', 'PHARMACY'), validate(pharmacyParamSchema), c.getPharmacyPrescriptions);
router.patch('/:id/review', authorizeRoles('SUPER_ADMIN', 'PHARMACY'), validate(reviewPrescriptionSchema), c.reviewPrescription);

export default router;
