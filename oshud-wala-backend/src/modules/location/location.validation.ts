import { z } from 'zod';

const lat = z.number().min(-90).max(90);
const lng = z.number().min(-180).max(180);
const pincode = z.string().regex(/^[1-9][0-9]{5}$/, 'PIN code must be a valid 6-digit Indian PIN');

export const createLocationSchema = z.object({
    body: z.object({
        city: z.string().trim().min(2).max(80),
        area: z.string().trim().min(2).max(80).optional().nullable(),
        state: z.string().trim().min(2).max(80),
        pincode,
        country: z.string().trim().min(2).max(60).optional(),
        latitude: lat.optional().nullable(),
        longitude: lng.optional().nullable(),
    }).refine((d) => (d.latitude == null) === (d.longitude == null), {
        message: 'latitude and longitude must be provided together',
        path: ['latitude'],
    }),
});

export const updateLocationSchema = z.object({
    params: z.object({ id: z.string().uuid() }),
    body: z.object({
        city: z.string().trim().min(2).max(80).optional(),
        area: z.string().trim().min(2).max(80).optional().nullable(),
        state: z.string().trim().min(2).max(80).optional(),
        pincode: pincode.optional(),
        country: z.string().trim().min(2).max(60).optional(),
        latitude: lat.optional().nullable(),
        longitude: lng.optional().nullable(),
    }).refine((d) => Object.keys(d).length > 0, { message: 'At least one field is required' }),
});

export const setLocationStatusSchema = z.object({
    params: z.object({ id: z.string().uuid() }),
    body: z.object({ isActive: z.boolean() }),
});

export const listLocationSchema = z.object({
    query: z.object({
        city: z.string().trim().optional(),
        state: z.string().trim().optional(),
        q: z.string().trim().optional(),
        isActive: z.enum(['true', 'false']).optional(), // admin list only
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
    }),
});
