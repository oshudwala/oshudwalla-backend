import { z } from 'zod';

export const registerTokenSchema = z.object({
    body: z.object({
        fcmToken: z.string().min(1, "FCM Token is required"),
        deviceType: z.enum(['ANDROID', 'IOS', 'WEB'], { 
            required_error: "Device type must be ANDROID, IOS, or WEB" 
        }),
        deviceId: z.string().optional()
    })
});