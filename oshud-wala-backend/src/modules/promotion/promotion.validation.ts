import { z } from 'zod';

export const createPromotionSchema = z.object({
    body: z.object({
        heading: z.string().trim().min(2).max(160),
        paragraph: z.string().trim().max(1000).optional().nullable(),
        imageUrl: z.string().trim().url('Valid imageUrl is required'),
        buttonText: z.string().trim().max(60).optional().nullable(),
        buttonLink: z.string().trim().max(300).optional().nullable(),
        couponCode: z.string().trim().max(40).optional().nullable(),
        placement: z.string().trim().min(2).max(50).default('HOME_TOP'),
        sortOrder: z.number().int().min(0).default(0),
        isActive: z.boolean().default(true),
        validFrom: z.string().datetime().optional().nullable(),
        validTo: z.string().datetime().optional().nullable(),
    }),
});

export const updatePromotionSchema = z.object({
    params: z.object({ id: z.string().uuid('Invalid promotion id') }),
    body: z.object({
        heading: z.string().trim().min(2).max(160).optional(),
        paragraph: z.string().trim().max(1000).optional().nullable(),
        imageUrl: z.string().trim().url().optional(),
        buttonText: z.string().trim().max(60).optional().nullable(),
        buttonLink: z.string().trim().max(300).optional().nullable(),
        couponCode: z.string().trim().max(40).optional().nullable(),
        placement: z.string().trim().min(2).max(50).optional(),
        sortOrder: z.number().int().min(0).optional(),
        isActive: z.boolean().optional(),
        validFrom: z.string().datetime().optional().nullable(),
        validTo: z.string().datetime().optional().nullable(),
    }).refine((d) => Object.keys(d).length > 0, { message: 'At least one field is required' }),
});

export const promotionIdParamSchema = z.object({
    params: z.object({ id: z.string().uuid('Invalid promotion id') }),
});
