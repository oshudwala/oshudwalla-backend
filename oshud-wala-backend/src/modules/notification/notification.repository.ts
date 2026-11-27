import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const saveOrUpdateDeviceToken = async (userId: string, fcmToken: string, deviceType: any, deviceId?: string) => {
    const existingToken = await prisma.deviceToken.findFirst({
        where: { userId, token: fcmToken }
    });

    if (existingToken) {
        return existingToken;
    }

    return await prisma.deviceToken.create({
        data: {
            userId,
            token: fcmToken,
            platform: deviceType, // Ekhane deviceType er value ta platform e dhukiye dilam
            deviceId: deviceId || ""
        }
    });
};

export const removeDeviceToken = async (userId: string, fcmToken: string) => {
    return await prisma.deviceToken.deleteMany({
        where: { userId, token: fcmToken }
    });
};



export const getNotificationSettings = async (userId: string) => {
    return await prisma.notificationSetting.findUnique({
        where: { userId }
    });
};

export const getNotificationPreferences = async (userId: string) => {
    return await prisma.notificationPreference.findMany({
        where: { userId }
    });
};

export const upsertGlobalSettings = async (userId: string, data: any) => {
    return await prisma.notificationSetting.upsert({
        where: { userId },
        update: data,
        create: { userId, ...data }
    });
};

export const upsertCategoryPreferences = async (userId: string, categories: any[]) => {
    // Execute multiple upserts in a transaction
    return await prisma.$transaction(
        categories.map(cat => 
            prisma.notificationPreference.upsert({
                where: { userId_category: { userId, category: cat.category } },
                update: { pushEnabled: cat.pushEnabled, inAppEnabled: cat.inAppEnabled },
                create: { userId, category: cat.category, pushEnabled: cat.pushEnabled, inAppEnabled: cat.inAppEnabled }
            })
        )
    );
};

// ---------------------------------------------------------------------------
// IN-APP NOTIFICATION REPOSITORY (Strictly scoped by userId)
// ---------------------------------------------------------------------------

export interface NotificationQueryOptions {
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
    category?: any;
}

export const getNotificationsByUser = async (userId: string, options: NotificationQueryOptions = {}) => {
    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(options.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = {
        userId,
        NOT: {
            dedupeKey: { startsWith: 'init_' }
        }
    };
    if (options.unreadOnly) {
        where.readAt = null;
    }
    if (options.category) {
        where.category = options.category;
    }

    const [items, total, unreadCount] = await Promise.all([
        prisma.notification.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
        }),
        prisma.notification.count({ where }),
        prisma.notification.count({ where: { userId, readAt: null } }),
    ]);

    return {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
        unreadCount,
    };
};

export const getUnreadCountByUser = async (userId: string) => {
    return await prisma.notification.count({
        where: {
            userId,
            readAt: null,
            NOT: {
                dedupeKey: { startsWith: 'init_' }
            }
        }
    });
};

export const markNotificationRead = async (notificationId: string, userId: string) => {
    return await prisma.notification.updateMany({
        where: { id: notificationId, userId },
        data: { readAt: new Date() }
    });
};

export const markAllNotificationsRead = async (userId: string) => {
    return await prisma.notification.updateMany({
        where: { userId, readAt: null },
        data: { readAt: new Date() }
    });
};

export const deleteNotification = async (notificationId: string, userId: string) => {
    return await prisma.notification.deleteMany({
        where: { id: notificationId, userId }
    });
};

export const clearReadNotifications = async (userId: string) => {
    return await prisma.notification.deleteMany({
        where: { userId, readAt: { not: null } }
    });
};

export const createInAppNotification = async (data: {
    userId: string;
    doctorId?: string;
    category: any;
    eventType: string;
    title: string;
    body: string;
    data?: any;
    priority?: any;
    dedupeKey?: string;
}) => {
    const dedupeKey = data.dedupeKey || `notif_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    return await prisma.notification.create({
        data: {
            userId: data.userId,
            doctorId: data.doctorId,
            category: data.category || 'SYSTEM',
            eventType: data.eventType || 'IN_APP_MESSAGE',
            title: data.title,
            body: data.body,
            data: data.data || {},
            priority: data.priority || 'NORMAL',
            dedupeKey,
        }
    });
};