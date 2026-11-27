import { z } from 'zod';

export const assignDeliveriesSchema = z.object({
    body: z.object({
        riderId: z.string().min(1, 'Rider identifier is required'),
        orderIds: z.array(z.string().min(1, 'Order ID is required')).min(1, 'At least one orderId is required').max(50),
    }),
});

export const scanPickupQrSchema = z.object({
    body: z.object({
        qrToken: z.string().trim().min(4, 'Valid qrToken is required'),
    }),
});

export const deliveryIdParamSchema = z.object({
    params: z.object({ deliveryId: z.string().min(1, 'Invalid deliveryId') }),
});

export const orderIdParamSchema = z.object({
    params: z.object({ orderId: z.string().min(1, 'Invalid orderId') }),
});

export const completeDeliverySchema = z.object({
    params: z.object({ deliveryId: z.string().min(1, 'Invalid deliveryId') }),
    body: z.object({
        otp: z.string().trim().regex(/^[0-9]{4,6}$/, 'Valid delivery OTP is required'),
    }),
});

