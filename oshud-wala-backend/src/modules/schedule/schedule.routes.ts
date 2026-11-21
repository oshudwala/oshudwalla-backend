import { Router } from 'express';
import { authenticate, authorizeRoles } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import * as c from './schedule.controller';
import {
    createScheduleSchema,
    upsertExceptionSchema,
    generateSlotsSchema,
    getPharmacyDoctorParamSchema,
    listSlotsSchema,
    updateSlotStatusSchema,
} from './schedule.validation';

const router = Router();

router.use(authenticate);

router.post('/', authorizeRoles('SUPER_ADMIN', 'PHARMACY', 'DOCTOR'), validate(createScheduleSchema), c.createSchedule);
router.get('/pharmacy-doctor/:pharmacyDoctorId', validate(getPharmacyDoctorParamSchema), c.getSchedules);
router.post('/exceptions', authorizeRoles('SUPER_ADMIN', 'PHARMACY', 'DOCTOR'), validate(upsertExceptionSchema), c.upsertException);
router.post('/generate-slots', authorizeRoles('SUPER_ADMIN', 'PHARMACY', 'DOCTOR'), validate(generateSlotsSchema), c.generateSlots);
router.get('/slots/:pharmacyDoctorId', validate(listSlotsSchema), c.getSlots);
router.patch('/slots/:slotId/status', authorizeRoles('SUPER_ADMIN', 'PHARMACY', 'DOCTOR'), validate(updateSlotStatusSchema), c.updateSlotStatus);

export default router;
