import { z } from 'zod';

export const createTicketSchema = z.object({
    body: z.object({
        subject: z.string().trim().min(3).max(200),
        message: z.string().trim().min(3).max(2000),
        orderId: z.string().uuid().optional().nullable(),
        priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
    }),
});

export const ticketIdParamSchema = z.object({
    params: z.object({ id: z.string().uuid('Invalid ticket id') }),
});

export const addMessageSchema = z.object({
    params: z.object({ id: z.string().uuid('Invalid ticket id') }),
    body: z.object({
        body: z.string().trim().min(1).max(2000),
    }),
});

export const updateTicketStatusSchema = z.object({
    params: z.object({ id: z.string().uuid('Invalid ticket id') }),
    body: z.object({
        status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
        priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
        assigneeId: z.string().uuid().optional().nullable(),
    }).refine((d) => Object.keys(d).length > 0, { message: 'At least one field is required' }),
});
