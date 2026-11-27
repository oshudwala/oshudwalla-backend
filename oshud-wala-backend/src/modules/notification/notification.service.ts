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

// ---------------------------------------------------------------------------
// IN-APP NOTIFICATIONS (Strictly isolated by userId with NO demo/dummy data)
// ---------------------------------------------------------------------------

export const fetchUserNotifications = async (userId: string, role?: string, options: any = {}) => {
    if (!userId) throw new ApiError(401, 'Unauthorized access');
    // Ensure pharmacy in-app notifications are synced with active db state
    await notificationRepo.syncPharmacyNotifications(userId, role);
    return await notificationRepo.getNotificationsByUser(userId, options);
};

export const countUnread = async (userId: string, role?: string) => {
    if (!userId) throw new ApiError(401, 'Unauthorized access');
    await notificationRepo.syncPharmacyNotifications(userId, role);
    const unreadCount = await notificationRepo.getUnreadCountByUser(userId);
    return { unreadCount };
};

export const markRead = async (notificationId: string, userId: string) => {
    if (!userId) throw new ApiError(401, 'Unauthorized access');
    await notificationRepo.markNotificationRead(notificationId, userId);
    return { success: true, notificationId };
};

export const markAllRead = async (userId: string) => {
    if (!userId) throw new ApiError(401, 'Unauthorized access');
    await notificationRepo.markAllNotificationsRead(userId);
    return { success: true };
};

export const removeNotification = async (notificationId: string, userId: string) => {
    if (!userId) throw new ApiError(401, 'Unauthorized access');
    await notificationRepo.deleteNotification(notificationId, userId);
    return { success: true, notificationId };
};

export const clearRead = async (userId: string) => {
    if (!userId) throw new ApiError(401, 'Unauthorized access');
    await notificationRepo.clearReadNotifications(userId);
    return { success: true };
};

export const createNotification = async (userId: string, data: any) => {
    if (!userId) throw new ApiError(401, 'Unauthorized access');
    const created = await notificationRepo.createInAppNotification({
        userId: data.userId || userId,
        category: data.category || 'SYSTEM',
        eventType: data.eventType || 'MANUAL_ALERT',
        title: data.title,
        body: data.body,
        data: data.data || {},
        priority: data.priority || 'NORMAL',
    });
    return created;
};