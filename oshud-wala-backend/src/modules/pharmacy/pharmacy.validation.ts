import { z } from 'zod';

export const createPharmacySchema = z.object({
    body: z.object({
        name: z.string().min(2, "Pharmacy name is required"),
        phone: z.string().min(10, "Valid phone is required"),
        email: z.string().email("Invalid email").optional().nullable(),
        line1: z.string().min(2, "Address line 1 is required"),
        line2: z.string().optional().nullable(),
        city: z.string().min(2, "City is required"),
        state: z.string().min(2, "State is required"),
        pincode: z.string().min(4, "Pincode is required"),
        isPrimary: z.boolean().optional().default(false)
    })
});