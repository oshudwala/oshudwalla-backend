import { z } from 'zod';

export const createOrderSchema = z.object({
    body: z.object({
        addressId: z.string().uuid('Valid addressId is required'),
        pharmacyId: z.string().uuid().optional().nullable(),
        prescriptionId: z.string().uuid().optional().nullable(),
        idempotencyKey: z.string().trim().min(4).max(100).optional().nullable(),
    }),
});

export const updateOrderStatusSchema = z.object({
    params: z.object({ id: z.string().uuid('Invalid order id') }),
    body: z.object({
        status: z.enum(['ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP', 'REJECTED']),
        reason: z.string().trim().max(300).optional().nullable(),
    }),
});

export const cancelOrderSchema = z.object({
    params: z.object({ id: z.string().uuid('Invalid order id') }),
    body: z.object({
        cancelReason: z.string().trim().max(300).optional().nullable(),
    }),
});

export const orderPharmacyParamSchema = z.object({
    params: z.object({ pharmacyId: z.string().uuid('Invalid pharmacyId') }),
});
