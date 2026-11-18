import { z } from 'zod';

export const createPharmacySchema = z.object({
    body: z.object({
        name: z.string().min(2, "Pharmacy name is required"),
        phone: z.string().min(10, "Valid phone is required"),
        email: z.string().email("Invalid email").optional().nullable(),
        line1: z.string().min(2, "Address line 1 is required"),
        line2: z.string().optional().nullable(),
        locationId: z.string().uuid("Invalid locationId").optional().nullable(),
        city: z.string().min(2).optional(),
        state: z.string().min(2).optional(),
        pincode: z.string().min(4).optional(),
        isPrimary: z.boolean().optional().default(false)
    }).refine((d) => !!d.locationId || (!!d.city && !!d.state && !!d.pincode), {
        message: 'Provide locationId, or city + state + pincode',
        path: ['locationId'],
    })
});


export const assignOwnerSchema = z.object({
    params: z.object({ id: z.string().uuid() }),
    body: z.object({ userId: z.string().uuid("Invalid userId") }),
});
