import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

export const createScheduleSchema = z.object({
    body: z.object({
        pharmacyDoctorId: z.string().uuid("Valid pharmacyDoctorId is required"),
        recurrenceType: z.enum(['DAILY', 'WEEKLY', 'MONTHLY_WEEK_DAY', 'SPECIFIC_DATE']).default('WEEKLY'),
        dayOfWeek: z.number().int().min(0).max(6).optional(),
        weekOfMonth: z.number().int().min(1).max(5).optional().nullable(),
        specificDate: isoDate.optional().nullable(),
        startMinute: z.number().int().min(0).max(1439),
        endMinute: z.number().int().min(1).max(1440),
        slotDurationMinutes: z.number().int().min(5).max(240),
        slotCapacity: z.number().int().min(1).max(50).default(1),
        validFrom: isoDate,
        validTo: isoDate.optional().nullable(),
    })
        .refine((d) => d.startMinute < d.endMinute, {
            message: 'startMinute must be less than endMinute',
            path: ['startMinute'],
        })
        .refine((d) => d.endMinute - d.startMinute >= d.slotDurationMinutes, {
            message: 'Schedule window must be at least as long as slotDurationMinutes',
            path: ['slotDurationMinutes'],
        })
        .refine((d) => d.recurrenceType !== 'SPECIFIC_DATE' || !!d.specificDate, {
            message: 'specificDate is required for SPECIFIC_DATE recurrence',
            path: ['specificDate'],
        })
        .refine((d) => d.recurrenceType !== 'MONTHLY_WEEK_DAY' || (d.weekOfMonth != null && d.dayOfWeek != null), {
            message: 'weekOfMonth (1-5) and dayOfWeek (0-6) are required for MONTHLY_WEEK_DAY recurrence',
            path: ['weekOfMonth'],
        })
        .refine((d) => d.recurrenceType !== 'WEEKLY' || d.dayOfWeek != null, {
            message: 'dayOfWeek (0-6) is required for WEEKLY recurrence',
            path: ['dayOfWeek'],
        }),
});

export const upsertExceptionSchema = z.object({
    body: z.object({
        pharmacyDoctorId: z.string().uuid("Valid pharmacyDoctorId is required"),
        exceptionDate: isoDate,
        type: z.enum(['LEAVE', 'MODIFIED_HOURS']),
        startMinute: z.number().int().min(0).max(1439).optional().nullable(),
        endMinute: z.number().int().min(1).max(1440).optional().nullable(),
        reason: z.string().trim().max(250).optional().nullable(),
    }).refine((d) => {
        if (d.type === 'LEAVE') return true;
        return d.startMinute != null && d.endMinute != null && d.startMinute < d.endMinute;
    }, {
        message: 'For MODIFIED_HOURS, startMinute and endMinute are required and startMinute < endMinute',
        path: ['startMinute'],
    }),
});

export const generateSlotsSchema = z.object({
    body: z.object({
        pharmacyDoctorId: z.string().uuid("Valid pharmacyDoctorId is required"),
        fromDate: isoDate,
        toDate: isoDate,
    }).refine((d) => d.fromDate <= d.toDate, {
        message: 'fromDate must be on or before toDate',
        path: ['fromDate'],
    }),
});

export const getPharmacyDoctorParamSchema = z.object({
    params: z.object({ pharmacyDoctorId: z.string().uuid("Invalid pharmacyDoctorId") }),
});

export const listSlotsSchema = z.object({
    params: z.object({ pharmacyDoctorId: z.string().uuid("Invalid pharmacyDoctorId") }),
    query: z.object({
        date: isoDate.optional(),
        fromDate: isoDate.optional(),
        toDate: isoDate.optional(),
    }),
});

export const updateSlotStatusSchema = z.object({
    params: z.object({ slotId: z.string().uuid("Invalid slotId") }),
    body: z.object({
        status: z.enum(['OPEN', 'BLOCKED']),
    }),
});
