import { z } from 'zod';

export const updateBookingRulesSchema = z.object({
    body: z.object({
        maxAdvanceBookingDays: z.number().int().min(1).max(90).optional(),
        minAdvanceBookingCutoffHours: z.number().int().min(0).max(72).optional(),
        cancellationDeadlineHours: z.number().int().min(0).max(72).optional(),
        refundPercentBeforeDeadline: z.number().int().min(0).max(100).optional(),
        refundPercentAfterDeadline: z.number().int().min(0).max(100).optional(),
        allowPatientSelfCancel: z.boolean().optional(),
        maxOnlineTokensPerHour: z.number().int().min(1).max(60).optional(),
        walkInReservationPercent: z.number().int().min(0).max(100).optional(),
        notifyPatientTokensAhead: z.number().int().min(1).max(20).optional(),
        platformConvenienceFeeRupees: z.number().int().min(0).max(5000).optional(),
        permittedPaymentMode: z.enum(['ONLINE_ONLY', 'CLINIC_ONLY', 'BOTH']).optional(),
    }).refine((d) => Object.keys(d).length > 0, {
        message: 'At least one booking rule field is required',
    }),
});
