import { z } from 'zod';

export const addDoctorSchema = z.object({
    body: z.object({
        pharmacyId: z.string().uuid("Valid Pharmacy ID is required"),
        phone: z.string().min(10, "Valid phone number is required").optional().nullable(),
        email: z.string().email("Invalid email").optional().nullable(),
        fullName: z.string().min(2, "Doctor's full name is required"),
        specializationId: z.string().uuid("Valid Specialization ID is required"),
        registrationNumber: z.string().min(2, "Medical Registration Number is required"),
        experienceYears: z.number().min(0, "Experience years cannot be negative").optional(),
        consultationFeePaise: z.number().min(0).default(0),
        bio: z.string().optional()
    }).refine((data) => data.phone || data.email, {
        message: "Either a valid phone number or an email must be provided",
        path: ["phone"]
    })
});