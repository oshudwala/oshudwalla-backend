import { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import * as notificationService from './notification.service';
import { AuthRequest } from '../../middlewares/auth.middleware';

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