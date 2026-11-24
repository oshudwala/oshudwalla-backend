import { z } from 'zod';

export const upsertReviewSchema = z.object({
    body: z.object({
        targetType: z.enum(['PHARMACY', 'DOCTOR']),
        targetId: z.string().uuid('Valid targetId is required'),
        rating: z.number().int().min(1, 'Rating must be between 1 and 5').max(5, 'Rating must be between 1 and 5'),
        comment: z.string().trim().max(500).optional(),
    }),
});
