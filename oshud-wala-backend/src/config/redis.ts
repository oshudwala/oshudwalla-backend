import Redis from 'ioredis';


// .env theke URL nibe, na thakle default local Redis use korbe
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Check korche URL ta secure (Upstash/rediss) naki local (redis)
const isSecure = redisUrl.startsWith('rediss://');

export const redisConnection = new Redis(redisUrl, {
    maxRetriesPerRequest: null, // BullMQ er jonno eta null rakhai rules
    tls: isSecure ? { rejectUnauthorized: false } : undefined
});

redisConnection.on('connect', () => {
    console.log(`📦 Connected to Redis (${isSecure ? 'Upstash' : 'Local'})`);
});

redisConnection.on('error', (err) => {
    console.error('❌ Redis Connection Error:', err.message);
});