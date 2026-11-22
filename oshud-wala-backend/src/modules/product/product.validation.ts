import { z } from 'zod';

export const createProductSchema = z.object({
    body: z.object({
        name: z.string().trim().min(2).max(150),
        slug: z.string().trim().min(2).max(160).regex(/^[a-z0-9-]+$/).optional(),
        genericName: z.string().trim().max(150).optional().nullable(),
        manufacturer: z.string().trim().max(120).optional().nullable(),
        categoryId: z.string().uuid('Valid categoryId is required'),
        description: z.string().trim().max(2000).optional().nullable(),
        packSize: z.string().trim().max(80).optional().nullable(),
        mrpPaise: z.number().int().min(1, 'mrpPaise must be at least 1 paise'),
        requiresPrescription: z.boolean().default(false),
        imageUrls: z.array(z.string().trim().url()).max(10).optional(),
        isActive: z.boolean().default(true),
    }),
});

export const updateProductSchema = z.object({
    params: z.object({ id: z.string().uuid('Invalid product id') }),
    body: z.object({
        name: z.string().trim().min(2).max(150).optional(),
        genericName: z.string().trim().max(150).optional().nullable(),
        manufacturer: z.string().trim().max(120).optional().nullable(),
        categoryId: z.string().uuid().optional(),
        description: z.string().trim().max(2000).optional().nullable(),
        packSize: z.string().trim().max(80).optional().nullable(),
        mrpPaise: z.number().int().min(1).optional(),
        requiresPrescription: z.boolean().optional(),
        imageUrls: z.array(z.string().trim().url()).max(10).optional(),
        isActive: z.boolean().optional(),
    }).refine((d) => Object.keys(d).length > 0, { message: 'At least one field is required' }),
});

export const listProductsSchema = z.object({
    query: z.object({
        q: z.string().trim().optional(),
        categoryId: z.string().uuid().optional(),
        requiresPrescription: z.enum(['true', 'false']).optional(),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
    }),
});

export const getProductSchema = z.object({
    params: z.object({ id: z.string().uuid('Invalid product id') }),
});
