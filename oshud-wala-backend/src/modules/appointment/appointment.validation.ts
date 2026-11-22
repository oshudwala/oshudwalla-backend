import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

export const bookAppointmentSchema = z.object({
    body: z.object({
        slotId: z.string().uuid("Valid slotId is required"),
        reason: z.string().trim().max(300).optional().nullable(),
        idempotencyKey: z.string().trim().min(4).max(100).optional().nullable(),
    }),
});

export const appointmentIdParamSchema = z.object({
    params: z.object({ id: z.string().uuid("Invalid appointment id") }),
});

export const cancelAppointmentSchema = z.object({
    params: z.object({ id: z.string().uuid("Invalid appointment id") }),
    body: z.object({
        cancelReason: z.string().trim().max(300).optional().nullable(),
    }),
});

export const updateAppointmentStatusSchema = z.object({
    params: z.object({ id: z.string().uuid("Invalid appointment id") }),
    body: z.object({
        status: z.enum(['CHECKED_IN', 'IN_CONSULTATION', 'COMPLETED', 'NO_SHOW']),
        doctorNotes: z.string().trim().max(1000).optional().nullable(),
    }),
});

export const listPharmacyDoctorAppointmentsSchema = z.object({
    params: z.object({ pharmacyDoctorId: z.string().uuid("Invalid pharmacyDoctorId") }),
    query: z.object({
        date: isoDate.optional(),
    }),
});

export const getQueueSchema = z.object({
    params: z.object({ pharmacyDoctorId: z.string().uuid("Invalid pharmacyDoctorId") }),
    query: z.object({
        date: isoDate.optional(),
    }),
});

export const updateQueueStatusSchema = z.object({
    params: z.object({ pharmacyDoctorId: z.string().uuid("Invalid pharmacyDoctorId") }),
    body: z.object({
        queueDate: isoDate,
        status: z.enum(['OPEN', 'PAUSED', 'CLOSED']),
    }),
});
