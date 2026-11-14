import { Worker, Job } from 'bullmq';
import { redisConnection } from '../../config/redis';

// Worker toiri: Je continuously queue theke job niye process korbe
export const notificationWorker = new Worker('NotificationQueue', async (job: Job) => {
    const { userId, title, body, data } = job.data;
    
    console.log(`\n[🛠️ Worker] Processing Job ID: ${job.id}`);
    console.log(`[🔔 Push Notification] To User: ${userId}`);
    console.log(`[📝 Message] ${title}: ${body}`);
    
    // Future er kaj: Ekhane FCM (Firebase) ba Socket.io er asol logic thakbe
    // ebong Database e NotificationDeliveries table e entry hobe.

    return { status: 'sent', time: new Date().toISOString() };
}, { 
    connection: redisConnection 
});

notificationWorker.on('completed', (job) => {
    console.log(`[✅ Worker] Job ${job.id} completed successfully`);
});

notificationWorker.on('failed', (job, err) => {
    console.log(`[❌ Worker] Job ${job?.id} failed: ${err.message}`);
});