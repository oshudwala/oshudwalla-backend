import { Queue, Worker } from 'bullmq';
import { redisConnection } from '../../config/redis';
import { deleteCloudinaryImage } from '../../utils/cloudinary.util';

export const PRESCRIPTION_CLEANUP_DELAY_MS = 48 * 60 * 60 * 1000; // 48 hours (2 days)

export const prescriptionCleanupQueue = new Queue('prescription-cleanup', {
    connection: redisConnection as any,
});

export const schedulePrescriptionImageCleanup = async (prescriptionId: string, storageKeys: string[]) => {
    if (storageKeys.length === 0) return;
    try {
        await prescriptionCleanupQueue.add(
            'delete-cloudinary-images',
            { prescriptionId, storageKeys },
            {
                delay: PRESCRIPTION_CLEANUP_DELAY_MS,
                attempts: 3,
                backoff: { type: 'exponential', delay: 60000 },
                removeOnComplete: true,
            }
        );
    } catch (e) {
        console.warn('BullMQ prescription cleanup queue warning:', (e as any)?.message || e);
    }
};

// Only start background worker outside Jest test runs
if (process.env.NODE_ENV !== 'test') {
    new Worker(
        'prescription-cleanup',
        async (job) => {
            const { storageKeys } = job.data as { prescriptionId: string; storageKeys: string[] };
            for (const key of storageKeys) {
                await deleteCloudinaryImage(key);
            }
        },
        { connection: redisConnection as any }
    );
}
