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
        isPrimary: z.boolean().optional(),
        hasClinicService: z.boolean().optional(),
        hasMedicineService: z.boolean().optional(),
        logoUrl: z.string().optional().nullable(),
        isFeatured: z.boolean().optional(),
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
        email: z.string().trim().email("Invalid email").optional().nullable(),
        line1: z.string().trim().min(2).optional(),
        line2: z.string().trim().optional().nullable(),
        city: z.string().trim().max(100).optional(),
        state: z.string().trim().max(100).optional(),
        pincode: z.string().trim().regex(/^[0-9]{6}$/, "Pincode must be 6 digits").optional(),
        licenseNumber: z.string().trim().max(100).optional().nullable(),
        logoUrl: z.string().optional().nullable(),
        hasClinicService: z.boolean().optional(),
        hasMedicineService: z.boolean().optional(),
        isFeatured: z.boolean().optional(),
        locationId: z.string().uuid().optional().nullable(),
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
        isFeatured: z.boolean().optional(),
        featuredOrder: z.number().int().optional(),
        hasClinicService: z.boolean().optional(),
        hasMedicineService: z.boolean().optional(),
    }).refine((d) => d.locationId !== undefined || d.status !== undefined || d.isFeatured !== undefined || d.featuredOrder !== undefined || d.hasClinicService !== undefined || d.hasMedicineService !== undefined, {
        message: 'At least one field to update is required',
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

export const updatePharmacyServicesSchema = z.object({
    params: z.object({ id: z.string().uuid("Invalid pharmacy id") }),
    body: z.object({
        hasClinicService: z.boolean().optional(),
        hasMedicineService: z.boolean().optional(),
    }).refine((d) => d.hasClinicService !== undefined || d.hasMedicineService !== undefined, {
        message: 'At least one of hasClinicService or hasMedicineService is required',
    }),
});

const openingHourItem = z.object({
    dayOfWeek: z.number().int().min(0).max(6),
    isClosed: z.boolean().default(false),
    openMinute: z.number().int().min(0).max(1439).optional().nullable(),
    closeMinute: z.number().int().min(1).max(1440).optional().nullable(),
}).refine((d) => {
    if (d.isClosed) return true;
    return d.openMinute != null && d.closeMinute != null && d.openMinute < d.closeMinute;
}, { message: 'When open, openMinute and closeMinute are required and openMinute must be less than closeMinute' });

export const updatePharmacyHoursSchema = z.object({
    params: z.object({ id: z.string().uuid("Invalid pharmacy id") }),
    body: z.object({
        hours: z.array(openingHourItem).min(1, "At least one day is required").max(7),
    }).refine((d) => new Set(d.hours.map((h) => h.dayOfWeek)).size === d.hours.length, {
        message: 'Duplicate dayOfWeek entries are not allowed',
        path: ['hours'],
    }),
});

export const getPharmacyHoursSchema = z.object({
    params: z.object({ id: z.string().uuid("Invalid pharmacy id") }),
});

export const addPharmacyHolidaySchema = z.object({
    params: z.object({ id: z.string().uuid("Invalid pharmacy id") }),
    body: z.object({
        holidayDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "holidayDate must be YYYY-MM-DD"),
        reason: z.string().trim().min(2).max(200).optional().nullable(),
    }),
});

export const removePharmacyHolidaySchema = z.object({
    params: z.object({
        id: z.string().uuid("Invalid pharmacy id"),
        holidayId: z.string().uuid("Invalid holiday id"),
    }),
});

export const createReceptionistSchema = z.object({
    params: z.object({ id: z.string().uuid("Invalid pharmacy id") }),
    body: z.object({
        fullName: z.string().trim().min(2, "Full name is required").max(100),
        phone: z.string().trim().regex(/^[0-9]{10,15}$/, "Valid phone number is required"),
        email: z.string().trim().email("Invalid email").optional().nullable(),
        password: z.string().min(8, "Password must be at least 8 characters").max(72),
    }),
});

export const listReceptionistsSchema = z.object({
    params: z.object({ id: z.string().uuid("Invalid pharmacy id") }),
});

export const updateReceptionistStatusSchema = z.object({
    params: z.object({
        id: z.string().uuid("Invalid pharmacy id"),
        staffId: z.string().uuid("Invalid staff id"),
    }),
    body: z.object({
        isActive: z.boolean(),
    }),
});
