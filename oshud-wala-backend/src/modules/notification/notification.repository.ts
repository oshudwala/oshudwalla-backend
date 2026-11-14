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