import { z } from 'zod';

const fileItem = z.object({
    storageKey: z.string().trim().min(2, 'Cloudinary public_id / storageKey is required').max(300),
    mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
    sizeBytes: z.number().int().min(1).max(10 * 1024 * 1024),
    checksumSha256: z.string().trim().min(8).max(128),
});

export const createPrescriptionSchema = z.object({
    body: z.object({
        pharmacyId: z.string().uuid().optional().nullable(),
        doctorName: z.string().trim().max(120).optional().nullable(),
        patientNote: z.string().trim().max(500).optional().nullable(),
        files: z.array(fileItem).min(1, 'At least one prescription file is required').max(5),
    }),
});

export const reviewPrescriptionSchema = z.object({
    params: z.object({ id: z.string().uuid('Invalid prescription id') }),
    body: z.object({
        status: z.enum(['VERIFIED', 'REJECTED']),
        rejectionReason: z.string().trim().max(300).optional().nullable(),
    }).refine((d) => d.status !== 'REJECTED' || Boolean(d.rejectionReason && d.rejectionReason.length >= 3), {
        message: 'rejectionReason is required when rejecting a prescription',
        path: ['rejectionReason'],
    }),
});

export const pharmacyParamSchema = z.object({
    params: z.object({ pharmacyId: z.string().uuid('Invalid pharmacyId') }),
});
