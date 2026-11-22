import { Router } from 'express';
import { authenticate, authorizeRoles } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import * as c from './appointment.controller';
import {
    bookAppointmentSchema,
    cancelAppointmentSchema,
    updateAppointmentStatusSchema,
    listPharmacyDoctorAppointmentsSchema,
    getQueueSchema,
    updateQueueStatusSchema,
} from './appointment.validation';

const router = Router();

router.use(authenticate);

// Patient booking & own list
router.post('/', authorizeRoles('PATIENT'), validate(bookAppointmentSchema), c.bookAppointment);
router.get('/my', authorizeRoles('PATIENT'), c.getMyAppointments);

// Live queue (all authenticated users can view; clinic staff/doctor/admin can pause/close)
router.get('/queue/:pharmacyDoctorId', validate(getQueueSchema), c.getLiveQueue);
router.patch('/queue/:pharmacyDoctorId/status', authorizeRoles('SUPER_ADMIN', 'PHARMACY', 'RECEPTIONIST', 'DOCTOR'), validate(updateQueueStatusSchema), c.updateQueueStatus);

// Clinic/Doctor appointment list
router.get('/pharmacy-doctor/:pharmacyDoctorId', authorizeRoles('SUPER_ADMIN', 'PHARMACY', 'RECEPTIONIST', 'DOCTOR'), validate(listPharmacyDoctorAppointmentsSchema), c.getPharmacyDoctorAppointments);

// Cancel & Status transitions
router.patch('/:id/cancel', authorizeRoles('PATIENT', 'SUPER_ADMIN', 'PHARMACY', 'RECEPTIONIST'), validate(cancelAppointmentSchema), c.cancelAppointment);
router.patch('/:id/status', authorizeRoles('SUPER_ADMIN', 'PHARMACY', 'RECEPTIONIST', 'DOCTOR'), validate(updateAppointmentStatusSchema), c.updateAppointmentStatus);

export default router;
