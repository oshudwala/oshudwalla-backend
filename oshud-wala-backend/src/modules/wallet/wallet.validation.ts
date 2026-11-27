import { z } from 'zod';

export const requestWithdrawalSchema = z.object({
    body: z.object({
        amount: z.number().min(1).optional(),
        amountPaise: z.number().int().min(100, 'Minimum withdrawal is 100 paise (₹1)').optional(),
        payoutDetails: z.object({
            method: z.enum(['UPI', 'OFFLINE_CASH', 'BANK', 'CASH', 'upi', 'offline_cash', 'bank', 'cash']),
            upiId: z.string().trim().min(3).max(100).optional(),
            accountNumber: z.string().trim().min(6).max(30).optional(),
            ifsc: z.string().trim().min(4).max(20).optional(),
            accountHolder: z.string().trim().min(2).max(100).optional(),
            note: z.string().trim().max(300).optional(),
        }),
        idempotencyKey: z.string().trim().min(4).max(100).optional().nullable(),
    }),
});

export const reviewWithdrawalSchema = z.object({
    params: z.object({ id: z.string().uuid('Invalid withdrawal id') }),
    body: z.object({
        decision: z.enum(['PAID', 'REJECTED']),
        method: z.string().trim().min(2).max(50).optional(),
        referenceNo: z.string().trim().max(120).optional().nullable(),
        rejectionReason: z.string().trim().max(300).optional().nullable(),
        password: z.string().optional(),
    }).refine((d) => d.decision !== 'REJECTED' || Boolean(d.rejectionReason && d.rejectionReason.length >= 3), {
        message: 'rejectionReason is required when rejecting a withdrawal',
        path: ['rejectionReason'],
    }),
});
