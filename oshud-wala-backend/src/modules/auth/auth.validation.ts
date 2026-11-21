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
export const sendRegisterOtpSchema = z.object({
    body: z.object({
        phone: z.string().trim().regex(/^[0-9]{10,15}$/, "Valid phone number is required"),
    }),
});

export const registerWithOtpSchema = z.object({
    body: z.object({
        fullName: z.string().trim().min(2, "Full name must be at least 2 characters"),
        phone: z.string().trim().regex(/^[0-9]{10,15}$/, "Valid phone number is required"),
        email: z.string().trim().email("Invalid email format").optional().nullable(),
        password: z.string().min(6, "Password must be at least 6 characters"),
        otp: z.string().trim().regex(/^[0-9]{6}$/, "Valid 6-digit OTP is required"),
    }),
});

export const sendLoginOtpSchema = z.object({
    body: z.object({
        phone: z.string().trim().regex(/^[0-9]{10,15}$/, "Valid phone number is required"),
    }),
});

export const verifyLoginOtpSchema = z.object({
    body: z.object({
        phone: z.string().trim().regex(/^[0-9]{10,15}$/, "Valid phone number is required"),
        otp: z.string().trim().regex(/^[0-9]{6}$/, "Valid 6-digit OTP is required"),
    }),
});
