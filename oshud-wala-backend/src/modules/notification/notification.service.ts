import { ApiError } from '../../utils/apiError';
import * as notificationRepo from './notification.repository';

export const registerDeviceToken = async (userId: string, fcmToken: string, deviceType: string, deviceId?: string) => {
    if (!userId) throw new ApiError(401, 'Unauthorized access');
    
    const tokenRecord = await notificationRepo.saveOrUpdateDeviceToken(userId, fcmToken, deviceType, deviceId);
    return { tokenRecord };
};

export const unregisterDeviceToken = async (userId: string, fcmToken: string) => {
    if (!userId) throw new ApiError(401, 'Unauthorized access');
    
    await notificationRepo.removeDeviceToken(userId, fcmToken);
    return null;
};


export const fetchPreferences = async (userId: string) => {
    if (!userId) throw new ApiError(401, 'Unauthorized access');

    let globalSettings = await notificationRepo.getNotificationSettings(userId);
    // Auto-create global setting jodi na thake
    if (!globalSettings) {
        globalSettings = await notificationRepo.upsertGlobalSettings(userId, { pushEnabled: true });
    }

    const categories = await notificationRepo.getNotificationPreferences(userId);
    return { globalSettings, categories };
};

export const modifyPreferences = async (userId: string, globalSettings?: any, categories?: any[]) => {
    if (!userId) throw new ApiError(401, 'Unauthorized access');

    let updatedGlobal = null;
    if (globalSettings) {
        updatedGlobal = await notificationRepo.upsertGlobalSettings(userId, globalSettings);
    }

    let updatedCategories = null;
    if (categories && categories.length > 0) {
        updatedCategories = await notificationRepo.upsertCategoryPreferences(userId, categories);
    }

    return await fetchPreferences(userId); // Return combined result
};