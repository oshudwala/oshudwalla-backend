import { z } from 'zod';
import { NotificationCategory } from '@prisma/client';

export const registerTokenSchema = z.object({
    body: z.object({
        fcmToken: z.string().min(1, "FCM Token is required"),
        deviceType: z.enum(['ANDROID', 'IOS', 'WEB'], { 
            required_error: "Device type must be ANDROID, IOS, or WEB" 
        }),
        deviceId: z.string().optional()
    })
});

export const updatePreferencesSchema = z.object({
    body: z.object({
        globalSettings: z.object({
            pushEnabled: z.boolean().optional(),
            quietStartMinute: z.number().min(0).max(1439).optional().nullable(),
            quietEndMinute: z.number().min(0).max(1439).optional().nullable(),
            timezone: z.string().optional()
        }).optional(),
        categories: z.array(z.object({
            category: z.nativeEnum(NotificationCategory),
            pushEnabled: z.boolean(),
            inAppEnabled: z.boolean()
        })).optional()
    })
});