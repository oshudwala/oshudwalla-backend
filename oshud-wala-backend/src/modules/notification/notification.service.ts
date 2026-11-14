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