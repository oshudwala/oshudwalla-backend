import { Router } from 'express';
import {
    onboardDoctor,
    getDoctorsList,
    listGlobalDoctors,
    getDoctorById,
    createGlobalDoctor,
    updateGlobalDoctor,
    assignDoctor,
    updateAssignmentStatus,
} from './doctor.controller';
import { validate } from '../../middlewares/validate.middleware';
import {
    addDoctorSchema,
    createGlobalDoctorSchema,
    updateGlobalDoctorSchema,
    getDoctorByIdSchema,
    assignDoctorSchema,
    updateAssignmentStatusSchema,
} from './doctor.validation';
import { authenticate, authorizeRoles } from '../../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

// Global doctor directory
router.get('/', listGlobalDoctors);
router.post('/', authorizeRoles('SUPER_ADMIN'), validate(createGlobalDoctorSchema), createGlobalDoctor);

// Pharmacy-doctor assignment (declared before '/:id')
router.get('/pharmacy/:pharmacyId', getDoctorsList);
router.post('/onboard', authorizeRoles('SUPER_ADMIN'), validate(addDoctorSchema), onboardDoctor);
router.post('/assign', authorizeRoles('SUPER_ADMIN', 'PHARMACY'), validate(assignDoctorSchema), assignDoctor);
router.patch('/assign/:assignmentId/status', authorizeRoles('SUPER_ADMIN', 'PHARMACY'), validate(updateAssignmentStatusSchema), updateAssignmentStatus);

// Single global doctor profile
router.get('/:id', validate(getDoctorByIdSchema), getDoctorById);
router.put('/:id', authorizeRoles('SUPER_ADMIN'), validate(updateGlobalDoctorSchema), updateGlobalDoctor);

export default router;
