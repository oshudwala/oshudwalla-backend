import { z } from 'zod';

export const createAddressSchema = z.object({
    body: z.object({
        label: z.string().optional(),
        fullName: z.string().min(2, "Full name is required"),
        phone: z.string().min(10, "Valid phone is required"),
        line1: z.string().min(2, "Address Line 1 is required"),
        line2: z.string().optional(),
        landmark: z.string().optional(),
        city: z.string().min(2, "City is required"),
        state: z.string().min(2, "State is required"),
        pincode: z.string().min(4, "Pincode is required"),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
        isDefault: z.boolean().optional()
    })
});

// Create er sob field optional kore update schema toiri
export const updateAddressSchema = z.object({
    body: createAddressSchema.shape.body.partial()
});