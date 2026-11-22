import { z } from 'zod';

export const createCategorySchema = z.object({
    body: z.object({
        name: z.string().trim().min(2).max(100),
        slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, or hyphens').optional(),
        parentId: z.string().uuid().optional().nullable(),
        imageUrl: z.string().trim().url().optional().nullable(),
        sortOrder: z.number().int().min(0).default(0),
        isActive: z.boolean().default(true),
    }),
});

export const updateCategorySchema = z.object({
    params: z.object({ id: z.string().uuid('Invalid category id') }),
    body: z.object({
        name: z.string().trim().min(2).max(100).optional(),
        parentId: z.string().uuid().optional().nullable(),
        imageUrl: z.string().trim().url().optional().nullable(),
        sortOrder: z.number().int().min(0).optional(),
        isActive: z.boolean().optional(),
    }).refine((d) => Object.keys(d).length > 0, { message: 'At least one field is required' }),
});
