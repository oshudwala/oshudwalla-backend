import { z } from 'zod';

const allowedRoles = z.enum([
    'ALL',
    'PATIENT',
    'DOCTOR',
    'PHARMACY',
    'RECEPTIONIST',
    'RIDER',
    'SUPER_ADMIN',
]);

export const createAnnouncementSchema = z.object({
    body: z.object({
        title: z.string().trim().min(2, 'Title is required').max(150),
        message: z.string().trim().min(2, 'Message is required').max(2000),
        priority: z.enum(['INFO', 'WARNING', 'URGENT']).default('INFO'),
        targetRoles: z.array(allowedRoles).min(1, 'At least one target role is required').default(['ALL']),
        isActive: z.boolean().default(true),
        expiresAt: z.string().datetime('expiresAt must be a valid ISO datetime').optional().nullable(),
    }),
});

export const updateAnnouncementSchema = z.object({
    params: z.object({
        id: z.string().uuid('Invalid announcement id'),
    }),
    body: z.object({
        title: z.string().trim().min(2).max(150).optional(),
        message: z.string().trim().min(2).max(2000).optional(),
        priority: z.enum(['INFO', 'WARNING', 'URGENT']).optional(),
        targetRoles: z.array(allowedRoles).min(1).optional(),
        isActive: z.boolean().optional(),
        expiresAt: z.string().datetime('expiresAt must be a valid ISO datetime').optional().nullable(),
    }).refine((d) => Object.keys(d).length > 0, {
        message: 'At least one field is required to update',
    }),
});

export const announcementIdParamSchema = z.object({
    params: z.object({
        id: z.string().uuid('Invalid announcement id'),
    }),
});
