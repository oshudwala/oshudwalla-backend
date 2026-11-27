import { z } from 'zod';

export const createRiderSchema = z.object({
    body: z.object({
        fullName: z.string().trim().min(2).max(100),
        phone: z.string().trim().regex(/^[0-9]{10,15}$/, 'Valid phone number is required'),
        email: z.string().trim().email('Valid email is required'),
        password: z.string().min(8, 'Password must be at least 8 characters').max(72),
        vehicleType: z.string().trim().min(2).max(50).optional().nullable(),
        vehicleNumber: z.string().trim().min(2).max(40).optional().nullable(),
        licenseNumber: z.string().trim().min(2).max(60).optional().nullable(),
    }),
});

export const updateRiderStatusSchema = z.object({
    params: z.object({ userId: z.string().uuid('Invalid rider userId') }),
    body: z.object({
        status: z.enum(['OFFLINE', 'AVAILABLE', 'BUSY', 'SUSPENDED']).optional(),
        kycStatus: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
    }).refine((d) => d.status !== undefined || d.kycStatus !== undefined, {
        message: 'At least one of status or kycStatus is required',
    }),
});

export const updateRiderSchema = z.object({
    params: z.object({ id: z.string().min(1, 'Rider ID is required') }),
    body: z.object({
        fullName: z.string().trim().min(2).max(100).optional(),
        phone: z.string().trim().regex(/^[0-9]{10,15}$/, 'Valid phone number is required').optional(),
        email: z.string().trim().email('Valid email is required').optional().nullable(),
        vehicleType: z.string().trim().min(2).max(50).optional().nullable(),
        vehicleNumber: z.string().trim().min(2).max(40).optional().nullable(),
        licenseNumber: z.string().trim().min(2).max(60).optional().nullable(),
        city: z.string().trim().max(100).optional().nullable(),
        status: z.enum(['OFFLINE', 'AVAILABLE', 'BUSY', 'SUSPENDED']).optional(),
        kycStatus: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
    }).refine((d) => Object.keys(d).length > 0, {
        message: 'At least one field to update is required',
    }),
});
