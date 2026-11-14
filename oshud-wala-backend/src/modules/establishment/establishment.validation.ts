import { z } from 'zod';
import { ServiceType } from '@prisma/client';

export const createEstablishmentByAdminSchema = z.object({
    body: z.object({
        name: z.string().min(2, "Establishment name is required"),
        phone: z.string().min(10, "Valid phone is required"),
        email: z.string().email("Invalid email").optional().nullable(),
        line1: z.string().min(2, "Address line 1 is required"),
        line2: z.string().optional().nullable(),
        city: z.string().min(2, "City is required"),
        state: z.string().min(2, "State is required"),
        pincode: z.string().min(4, "Pincode is required"),
        services: z.array(z.nativeEnum(ServiceType)).min(1, "At least one service (CLINIC or PHARMACY) must be selected"),
        isPrimaryPharmacy: z.boolean().optional().default(false)
    })
});