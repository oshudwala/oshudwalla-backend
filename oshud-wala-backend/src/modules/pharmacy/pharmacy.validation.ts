import { z } from 'zod';

const lat = z.number().min(-90).max(90);
const lng = z.number().min(-180).max(180);

export const createPharmacySchema = z.object({
    body: z.object({
        name: z.string().trim().min(2, "Pharmacy name is required"),
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
