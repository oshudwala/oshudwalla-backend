import { z } from 'zod';
import { RoleName, UserStatus } from '@prisma/client';

export const updateUserAccessSchema = z.object({
    body: z.object({
        roleName: z.nativeEnum(RoleName, { required_error: "Valid roleName is required" }),
        status: z.nativeEnum(UserStatus).optional()
    })
});

export const updateUserProfileSchema = z.object({
    params: z.object({ id: z.string().uuid("Invalid user id") }),
    body: z.object({
        fullName: z.string().trim().min(2, "Full name must be at least 2 characters").max(120).optional(),
        email: z.string().trim().email("Invalid email address").optional().nullable(),
        phone: z.string().trim().regex(/^[0-9]{10,15}$/, "Valid 10-15 digit phone number required").optional(),
        status: z.nativeEnum(UserStatus).optional(),
        roleName: z.nativeEnum(RoleName).optional(),
    }).refine((d) => Object.keys(d).length > 0, {
        message: "At least one field to update is required",
    }),
});

export const platformSettingSchema = z.object({
    body: z.object({
        key: z.string().min(1, "Setting key is required"),
        value: z.any() // JSON value
    })
});