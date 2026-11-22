import { z } from 'zod';

export const createCouponSchema = z.object({
    body: z.object({
        code: z.string().trim().min(3).max(40).regex(/^[A-Z0-9_-]+$/i, 'Code must be alphanumeric'),
        description: z.string().trim().max(300).optional().nullable(),
        discountType: z.enum(['PERCENT', 'FLAT']),
        discountValue: z.number().int().min(1),
        maxDiscountPaise: z.number().int().min(1).optional().nullable(),
        minOrderPaise: z.number().int().min(0).default(0),
        validFrom: z.string().datetime(),
        validTo: z.string().datetime(),
        usageLimitTotal: z.number().int().min(1).optional().nullable(),
        usageLimitPerUser: z.number().int().min(1).optional().nullable(),
        isActive: z.boolean().default(true),
    }).refine((d) => new Date(d.validFrom) < new Date(d.validTo), {
        message: 'validFrom must be before validTo',
        path: ['validTo'],
    }).refine((d) => d.discountType !== 'PERCENT' || d.discountValue <= 100, {
        message: 'PERCENT discountValue cannot exceed 100',
        path: ['discountValue'],
    }),
});

export const validateCouponSchema = z.object({
    body: z.object({
        code: z.string().trim().min(2).max(40),
        subtotalPaise: z.number().int().min(1),
    }),
});

export const updateCouponStatusSchema = z.object({
    params: z.object({ id: z.string().uuid('Invalid coupon id') }),
    body: z.object({ isActive: z.boolean() }),
});
