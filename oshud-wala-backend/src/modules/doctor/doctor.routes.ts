import { Router } from 'express';
import { onboardDoctor, getDoctorsList } from './doctor.controller';
import { validate } from '../../middlewares/validate.middleware';
import { addDoctorSchema } from './doctor.validation';
import { authenticate, authorizeRoles } from '../../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/pharmacy/:pharmacyId', getDoctorsList);

// SUPER_ADMIN only for now. PHARMACY (own pharmacy only) is added in the Doctor module step,
// once the Pharmacy owner link exists for resource-level authorization.
router.post('/onboard', authorizeRoles('SUPER_ADMIN'), validate(addDoctorSchema), onboardDoctor);

export default router;