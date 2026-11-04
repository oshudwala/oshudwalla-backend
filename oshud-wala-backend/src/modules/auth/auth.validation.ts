import { z } from 'zod';

export const registerSchema = z.object({
    body: z.object({
        fullName: z.string().min(2, "Full name must be at least 2 characters"),
        phone: z.string().min(10, "Valid phone number is required"),
        email: z.string().email("Invalid email format").optional().nullable(),
        password: z.string().min(6, "Password must be at least 6 characters"),
    })
});

export const loginSchema = z.object({
    body: z.object({
        identifier: z.string().min(1, "Phone or Email is required"),
        password: z.string().min(1, "Password is required"),
    })
});

export const refreshSchema = z.object({
    body: z.object({
        refreshToken: z.string().min(1, "Refresh token is required"),
        sessionId: z.string().uuid("Invalid session ID format")
    })
});