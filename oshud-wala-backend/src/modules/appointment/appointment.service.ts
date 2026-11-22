import { AppointmentStatus, QueueStatus, RoleName } from '@prisma/client';
import { ApiError } from '../../utils/apiError';
import * as repo from './appointment.repository';

type Actor = { id: string; role: RoleName };

const toUtcDate = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);
const todayUtcDate = (): Date => toUtcDate(new Date().toISOString().slice(0, 10));

const assertCanManageClinicQueue = async (pharmacyDoctorId: string, actor: Actor) => {
    const pd = await repo.findPharmacyDoctorContext(pharmacyDoctorId);
    if (!pd) throw new ApiError(404, 'Doctor-pharmacy assignment not found');

    if (actor.role === 'SUPER_ADMIN') return pd;

    if (actor.role === 'PHARMACY' || actor.role === 'RECEPTIONIST') {
        const staff = await repo.findActiveStaffLink(actor.id, pd.pharmacyId);
        if (!staff) throw new ApiError(403, 'You can only manage appointments/queue for your own pharmacy');
        return pd;
    }

    if (actor.role === 'DOCTOR') {
        if (pd.doctor.userId !== actor.id) throw new ApiError(403, 'You can only manage your own appointments');
        return pd;
    }

    throw new ApiError(403, 'Forbidden');
};

export const bookAppointment = async (body: any, actor: Actor) => {
    const reason = body.reason ? String(body.reason).trim() : null;
    const idempotencyKey = body.idempotencyKey ? String(body.idempotencyKey).trim() : null;
    return await repo.bookAppointmentTx(actor.id, body.slotId, reason, idempotencyKey, actor);
};

export const fetchMyAppointments = async (patientId: string) => {
    return await repo.listPatientAppointments(patientId);
};

export const fetchPharmacyDoctorAppointments = async (pharmacyDoctorId: string, date: string | undefined, actor: Actor) => {
    await assertCanManageClinicQueue(pharmacyDoctorId, actor);
    return await repo.listPharmacyDoctorAppointments(pharmacyDoctorId, date ? toUtcDate(date) : undefined);
};

export const cancelAppointment = async (appointmentId: string, cancelReason: string | null | undefined, actor: Actor) => {
    const appointment = await repo.findAppointmentById(appointmentId);
    if (!appointment) throw new ApiError(404, 'Appointment not found');

    if (actor.role === 'PATIENT') {
        if (appointment.patientId !== actor.id) throw new ApiError(403, 'You can only cancel your own appointment');
    } else {
        await assertCanManageClinicQueue(appointment.pharmacyDoctorId, actor);
    }

    if (appointment.status !== 'BOOKED' && appointment.status !== 'CHECKED_IN') {
        throw new ApiError(400, `Cannot cancel an appointment in ${appointment.status} status`);
    }

    return await repo.cancelAppointmentTx(appointment, cancelReason ? String(cancelReason).trim() : null, actor);
};

export const updateAppointmentStatus = async (
    appointmentId: string,
    status: AppointmentStatus,
    doctorNotes: string | undefined,
    actor: Actor
) => {
    const appointment = await repo.findAppointmentById(appointmentId);
    if (!appointment) throw new ApiError(404, 'Appointment not found');

    await assertCanManageClinicQueue(appointment.pharmacyDoctorId, actor);

    if (appointment.status === 'CANCELLED' || appointment.status === 'COMPLETED') {
        throw new ApiError(400, `Appointment is already ${appointment.status}`);
    }

    return await repo.updateAppointmentStatusTx(appointment, status, doctorNotes, actor);
};

export const fetchLiveQueue = async (pharmacyDoctorId: string, date?: string) => {
    const pd = await repo.findPharmacyDoctorContext(pharmacyDoctorId);
    if (!pd) throw new ApiError(404, 'Doctor-pharmacy assignment not found');
    return await repo.getQueueForDate(pharmacyDoctorId, date ? toUtcDate(date) : todayUtcDate());
};

export const setQueueStatus = async (pharmacyDoctorId: string, queueDate: string, status: QueueStatus, actor: Actor) => {
    await assertCanManageClinicQueue(pharmacyDoctorId, actor);
    return await repo.updateQueueStatusTx(pharmacyDoctorId, toUtcDate(queueDate), status, actor);
};
