import { z } from 'zod';

export const assignDeliveriesSchema = z.object({
    body: z.object({
        riderId: z.string().uuid('Valid riderId (User UUID) is required'),
        orderIds: z.array(z.string().uuid('Invalid orderId')).min(1, 'At least one orderId is required').max(20),
    }),
});

export const scanPickupQrSchema = z.object({
    body: z.object({
        qrToken: z.string().trim().min(10, 'Valid qrToken is required'),
    }),
});

export const deliveryIdParamSchema = z.object({
    params: z.object({ deliveryId: z.string().uuid('Invalid deliveryId') }),
});

export const orderIdParamSchema = z.object({
    params: z.object({ orderId: z.string().uuid('Invalid orderId') }),
});

export const completeDeliverySchema = z.object({
    params: z.object({ deliveryId: z.string().uuid('Invalid deliveryId') }),
    body: z.object({
        otp: z.string().trim().regex(/^[0-9]{6}$/, 'Valid 6-digit delivery OTP is required'),
    }),
});
