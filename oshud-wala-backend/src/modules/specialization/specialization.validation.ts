import { z } from 'zod';

export const createSpecializationSchema = z.object({
    body: z.object({
        name: z.string().min(2, "Specialization name is required"),
        description: z.string().optional()
    })
});