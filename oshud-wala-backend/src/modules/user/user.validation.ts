import { z } from 'zod';

export const updateProfileSchema = z.object({
    body: z.object({
        fullName: z.string().min(2, "Full name must be at least 2 characters").optional(),
        email: z.string().email("Invalid email format").optional().nullable(),
        dateOfBirth: z.string().datetime().optional().nullable(), // ISO string format
        gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional().nullable(),
        bloodGroup: z.string().optional().nullable(),
        allergies: z.string().optional().nullable(),
        medicalNotes: z.string().optional().nullable(),
    })
});