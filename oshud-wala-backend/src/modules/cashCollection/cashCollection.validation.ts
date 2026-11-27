import { z } from 'zod';

export const submitDepositSchema = z.object({
    body: z.object({
        amount: z.number().min(1).optional(),
        amountPaise: z.number().int().min(100).optional(),
        collectionIds: z.array(z.string()).optional(),
        method: z.string().optional(),
        referenceNo: z.string().trim().max(120).optional().nullable(),
    }),
});

export const verifyDepositSchema = z.object({
    params: z.object({ id: z.string().uuid('Invalid deposit id') }),
    body: z.object({
        decision: z.enum(['VERIFIED', 'REJECTED']),
        password: z.string().optional(),
        rejectionReason: z.string().trim().max(300).optional().nullable(),
    }).refine((d) => d.decision !== 'REJECTED' || Boolean(d.rejectionReason && d.rejectionReason.length >= 3), {
        message: 'rejectionReason is required when rejecting a deposit',
        path: ['rejectionReason'],
    }),
});
