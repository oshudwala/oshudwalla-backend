import { Queue } from 'bullmq';
import { redisConnection } from '../../config/redis';

// Queue Toiri
export const notificationQueue = new Queue('NotificationQueue', {
    connection: redisConnection,
});

// Helper function: API theke job add korar jonno
export const enqueueNotification = async (payload: { userId: string, title: string, body: string, data?: any }) => {
    return await notificationQueue.add('send-push', payload, {
        attempts: 3, // Fail hole 3 bar try korbe
        backoff: {
            type: 'exponential',
            delay: 2000, // 2 sec, 4 sec, 8 sec eivabe retry korbe
        },
        removeOnComplete: true, // Success hole queue theke delete kore dibe
    });
};