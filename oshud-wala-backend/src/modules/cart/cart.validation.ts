import { z } from 'zod';

export const addCartItemSchema = z.object({
    body: z.object({
        productId: z.string().uuid('Valid productId is required'),
        quantity: z.number().int().min(1).max(50).default(1),
    }),
});

export const updateCartItemSchema = z.object({
    params: z.object({ productId: z.string().uuid('Invalid productId') }),
    body: z.object({
        quantity: z.number().int().min(0).max(50),
    }),
});

export const removeCartItemSchema = z.object({
    params: z.object({ productId: z.string().uuid('Invalid productId') }),
});
