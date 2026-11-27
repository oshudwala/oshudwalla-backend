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
        bio: z.string().optional(),
    }).refine((data) => data.phone || data.email, {
        message: "Either a valid phone number or an email must be provided",
        path: ["phone"],
    }),
});

export const createGlobalDoctorSchema = z.object({
    body: z.object({
        fullName: z.string().trim().min(2, "Doctor full name is required").max(120),
        phone: z.string().trim().regex(/^[0-9]{10,15}$/, "Valid phone number is required").optional().nullable(),
        email: z.string().trim().email("Invalid email").optional().nullable(),
        registrationNumber: z.string().trim().min(2, "Medical registration number is required").max(80),
        qualifications: z.string().trim().max(200).optional().nullable(),
        experienceYears: z.number().int().min(0).max(80).optional().nullable(),
        bio: z.string().trim().max(1000).optional().nullable(),
        languages: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
        specializationIds: z.array(z.string().uuid("Invalid specializationId")).min(1, "At least one specialization is required").max(10),
        isVerified: z.boolean().optional(),
        isFeatured: z.boolean().optional(),
    }).refine((d) => Boolean(d.phone || d.email), {
        message: "Either phone or email must be provided",
        path: ["phone"],
    }),
});

export const updateGlobalDoctorSchema = z.object({
    params: z.object({ id: z.string().uuid("Invalid doctor id") }),
    body: z.object({
        fullName: z.string().trim().min(2).max(120).optional(),
        phone: z.string().trim().regex(/^[0-9]{10,15}$/, "Valid phone number is required").optional().nullable(),
        email: z.string().trim().email("Invalid email").optional().nullable(),
        registrationNumber: z.string().trim().min(2).max(80).optional().nullable(),
        qualifications: z.string().trim().max(200).optional().nullable(),
        experienceYears: z.number().int().min(0).max(80).optional().nullable(),
        bio: z.string().trim().max(1000).optional().nullable(),
        languages: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
        specializationIds: z.array(z.string().uuid()).min(1).max(10).optional(),
        isVerified: z.boolean().optional(),
        isFeatured: z.boolean().optional(),
    }).refine((d) => Object.keys(d).length > 0, {
        message: "At least one field is required",
    }),
});

export const getDoctorByIdSchema = z.object({
    params: z.object({ id: z.string().uuid("Invalid doctor id") }),
});

export const assignDoctorSchema = z.object({
    body: z.object({
        pharmacyId: z.string().uuid("Valid pharmacyId is required"),
        doctorId: z.string().uuid("Valid doctorId is required"),
        consultationFeePaise: z.number().int().min(0).max(10000000).default(0),
    }),
});

export const updateAssignmentStatusSchema = z.object({
    params: z.object({ assignmentId: z.string().uuid("Invalid assignmentId") }),
    body: z.object({
        isActive: z.boolean(),
    }),
});
