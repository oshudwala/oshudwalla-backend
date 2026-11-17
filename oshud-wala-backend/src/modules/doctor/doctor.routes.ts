import { Router } from 'express';
import { onboardDoctor, getDoctorsList } from './doctor.controller';
import { validate } from '../../middlewares/validate.middleware';
import { addDoctorSchema } from './doctor.validation';
import { authenticate, authorizeRoles } from '../../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/pharmacy/:pharmacyId', getDoctorsList);

// SUPER_ADMIN and PHARMACY_ADMIN can onboard/assign doctors to a pharmacy
router.post('/onboard', authorizeRoles('SUPER_ADMIN', 'PHARMACY_ADMIN'), validate(addDoctorSchema), onboardDoctor);

export default router;