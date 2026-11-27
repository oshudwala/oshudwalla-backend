import { z } from 'zod';

export const createOrderSchema = z.object({
    body: z.object({
        addressId: z.string().uuid('Valid addressId is required'),
        pharmacyId: z.string().uuid().optional().nullable(),
        prescriptionId: z.string().uuid().optional().nullable(),
        couponCode: z.string().trim().min(2).max(40).optional().nullable(),
        idempotencyKey: z.string().trim().min(4).max(100).optional().nullable(),
        items: z.array(
            z.object({
                productId: z.string().uuid().optional(),
                id: z.string().uuid().optional(),
                quantity: z.number().int().min(1).optional(),
                qty: z.number().int().min(1).optional(),
            })
        ).optional().nullable(),
    }),
});

export const createWalkInOrderSchema = z.object({
    body: z.object({
        customerName: z.string().trim().min(1).max(120),
        customerPhone: z.string().trim().min(7).max(20),
        deliveryType: z.enum(['DELIVERY', 'PICKUP']).default('DELIVERY').optional(),
        prescriptionId: z.string().trim().optional().nullable(),
        address: z.string().trim().max(300).optional().nullable(),
        area: z.string().trim().max(100).optional().nullable(),
        pincode: z.string().trim().max(20).optional().nullable(),
        items: z.array(
            z.object({
                name: z.string().trim().min(1),
                quantity: z.coerce.number().min(1).default(1),
                qty: z.coerce.number().min(1).optional(),
                price: z.coerce.number().min(0),
                productId: z.string().trim().optional().nullable(),
            })
        ).min(1, 'At least one medicine item is required'),
        subtotal: z.coerce.number().min(0),
        discount: z.coerce.number().min(0).default(0).optional(),
        discountType: z.enum(['PERCENT', 'FLAT']).optional().nullable(),
        discountValue: z.coerce.number().min(0).optional().nullable(),
        packagingFee: z.coerce.number().min(0).default(6).optional(),
        platformFee: z.coerce.number().min(0).default(0).optional(),
        deliveryFee: z.coerce.number().min(0).default(0).optional(),
        total: z.coerce.number().min(0),
        notes: z.string().trim().max(500).optional().nullable(),
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
