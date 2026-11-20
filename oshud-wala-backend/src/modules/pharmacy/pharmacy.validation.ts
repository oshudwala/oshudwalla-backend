import { z } from 'zod';

const lat = z.number().min(-90).max(90);
const lng = z.number().min(-180).max(180);

export const createPharmacySchema = z.object({
    body: z.object({
        name: z.string().trim().min(2, "Pharmacy name is required"),
        nameBn: z.string().trim().min(2).max(100).optional().nullable(),
        nameHi: z.string().trim().min(2).max(100).optional().nullable(),
        ownerName: z.string().trim().min(2, "Owner name is required"),
        ownerEmail: z.string().trim().email("Invalid owner email"),
        ownerPassword: z.string().min(8, "Password must be at least 8 characters").max(72),
        phone: z.string().trim().regex(/^[0-9]{10,15}$/, "Valid phone number is required"),
        locationId: z.string().uuid("Valid locationId is required"),
        line1: z.string().trim().min(2, "Street address is required"),
        line2: z.string().trim().optional().nullable(),
        latitude: lat.optional().nullable(),
        longitude: lng.optional().nullable(),
        isPrimary: z.boolean().optional()
    }).refine((d) => (d.latitude == null) === (d.longitude == null), {
        message: 'latitude and longitude must be provided together',
        path: ['latitude'],
    })
});


export const updatePharmacySchema = z.object({
    params: z.object({ id: z.string().uuid("Invalid pharmacy id") }),
    body: z.object({
        name: z.string().trim().min(2).max(120).optional(),
        nameBn: z.string().trim().min(2).max(100).optional().nullable(),
        nameHi: z.string().trim().min(2).max(100).optional().nullable(),
        phone: z.string().trim().regex(/^[0-9]{10,15}$/, "Valid phone number is required").optional(),
        line1: z.string().trim().min(2).optional(),
        line2: z.string().trim().optional().nullable(),
        latitude: lat.optional().nullable(),
        longitude: lng.optional().nullable(),
    })
        .refine((d) => Object.keys(d).length > 0, { message: 'At least one field is required' })
        .refine((d) => (d.latitude === undefined) === (d.longitude === undefined) && ((d.latitude == null) === (d.longitude == null)), {
            message: 'latitude and longitude must be provided together',
            path: ['latitude'],
        }),
});

export const adminUpdatePharmacySchema = z.object({
    params: z.object({ id: z.string().uuid("Invalid pharmacy id") }),
    body: z.object({
        locationId: z.string().uuid("Valid locationId is required").optional(),
        status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
    }).refine((d) => d.locationId !== undefined || d.status !== undefined, {
        message: 'At least one of locationId or status is required',
    }),
});

const httpUrl = z
    .string()
    .trim()
    .url("Must be a valid URL")
    .refine((u) => u.startsWith('http://') || u.startsWith('https://'), {
        message: 'URL must start with http:// or https://',
    });

export const updatePharmacyMediaSchema = z.object({
    params: z.object({ id: z.string().uuid("Invalid pharmacy id") }),
    body: z.object({
        logoUrl: httpUrl.optional().nullable(),
        coverUrl: httpUrl.optional().nullable(),
        galleryUrls: z.array(httpUrl).max(10, "Maximum 10 gallery images allowed").optional(),
    }).refine((d) => d.logoUrl !== undefined || d.coverUrl !== undefined || d.galleryUrls !== undefined, {
        message: 'At least one of logoUrl, coverUrl, or galleryUrls is required',
    }),
});
