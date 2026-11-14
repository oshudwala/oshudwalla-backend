import { z } from 'zod';
import { RoleName, UserStatus } from '@prisma/client';

export const updateUserAccessSchema = z.object({
    body: z.object({
        roleName: z.nativeEnum(RoleName, { required_error: "Valid roleName is required" }),
        status: z.nativeEnum(UserStatus).optional()
    })
});

export const platformSettingSchema = z.object({
    body: z.object({
        key: z.string().min(1, "Setting key is required"),
        value: z.any() // JSON value
    })
});