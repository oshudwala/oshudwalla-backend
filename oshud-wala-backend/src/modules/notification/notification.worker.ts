import { Worker, Job } from 'bullmq';
import { redisConnection } from '../../config/redis';
import * as notificationRepo from './notification.repository';

export const notificationWorker = new Worker(
  'NotificationQueue',
  async (job: Job) => {
    const { userId, title, body, data, category, eventType, priority } = job.data;

    console.log(`\n[🛠️ Worker] Processing Job ID: ${job.id} -> User: ${userId}`);

    // Save to DB so In-App Bell & Browser OS Notification both receive it
    if (userId && title && body) {
      await notificationRepo.createInAppNotification({
        userId,
        category: category || 'SYSTEM',
        eventType: eventType || 'PUSH_NOTIFICATION',
        title,
        body,
        data: data || {},
        priority: priority || 'NORMAL',
      });
    }

    return { status: 'sent', time: new Date().toISOString() };
  },
  {
    connection: redisConnection,
  }
);

notificationWorker.on('completed', (job) => {
  console.log(`[✅ Worker] Job ${job.id} completed successfully`);
});

notificationWorker.on('failed', (job, err) => {
  console.log(`[❌ Worker] Job ${job?.id} failed: ${err.message}`);
});