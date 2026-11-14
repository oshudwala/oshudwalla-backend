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