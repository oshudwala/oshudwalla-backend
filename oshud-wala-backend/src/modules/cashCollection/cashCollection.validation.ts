import { z } from 'zod';

export const submitDepositSchema = z.object({
    body: z.object({
        collectionIds: z.array(z.string().uuid('Invalid collectionId')).min(1, 'At least one collectionId is required'),
        method: z.enum(['CASH_HANDOVER', 'UPI', 'BANK_DEPOSIT']),
        referenceNo: z.string().trim().max(120).optional().nullable(),
    }),
});

export const verifyDepositSchema = z.object({
    params: z.object({ id: z.string().uuid('Invalid deposit id') }),
    body: z.object({
        decision: z.enum(['VERIFIED', 'REJECTED']),
        rejectionReason: z.string().trim().max(300).optional().nullable(),
    }).refine((d) => d.decision !== 'REJECTED' || Boolean(d.rejectionReason && d.rejectionReason.length >= 3), {
        message: 'rejectionReason is required when rejecting a deposit',
        path: ['rejectionReason'],
    }),
});
