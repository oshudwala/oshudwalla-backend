import { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import * as notificationService from './notification.service';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { enqueueNotification } from './notification.queue';

export const registerToken = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.userId;
    const { fcmToken, deviceType, deviceId } = req.body;
    
    const result = await notificationService.registerDeviceToken(userId as string, fcmToken, deviceType, deviceId);
    res.status(200).json(new ApiResponse(200, result, "Device token registered successfully"));
});

export const removeToken = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.userId;
    const { fcmToken } = req.body;

    await notificationService.unregisterDeviceToken(userId as string, fcmToken);
    res.status(200).json(new ApiResponse(200, null, "Device token removed successfully"));
});


export const getPreferences = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.userId;
    const result = await notificationService.fetchPreferences(userId as string);
    res.status(200).json(new ApiResponse(200, result, "Notification preferences retrieved"));
});

export const updatePreferences = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.userId;
    const { globalSettings, categories } = req.body;

    const result = await notificationService.modifyPreferences(userId as string, globalSettings, categories);
    res.status(200).json(new ApiResponse(200, result, "Notification preferences updated"));
});

export const sendTestPush = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.userId;
    const { title, body } = req.body;

    // Background Queue te job pathano hocche (Fast response)
    await enqueueNotification({
        userId: userId as string,
        title: title || "Test BullMQ Notification",
        body: body || "This job is processed in the background by Redis!",
    });

    res.status(200).json(new ApiResponse(200, null, "Push notification job enqueued successfully"));
});