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

// ---------------------------------------------------------------------------
// IN-APP NOTIFICATIONS HANDLERS (Strictly scoped to req.user.userId)
// ---------------------------------------------------------------------------

export const getMyNotifications = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const userRole = req.user?.role;
    const { page, limit, unreadOnly, category } = req.query;

    const data = await notificationService.fetchUserNotifications(userId, userRole, {
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        unreadOnly: unreadOnly === 'true' || unreadOnly === '1',
        category: category as string,
    });

    res.status(200).json(new ApiResponse(200, data, "User notifications retrieved successfully"));
});

export const getUnreadCount = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const data = await notificationService.countUnread(userId);
    res.status(200).json(new ApiResponse(200, data, "Unread notification count retrieved"));
});

export const markNotificationAsRead = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const notificationId = req.params.id;
    const data = await notificationService.markRead(notificationId, userId);
    res.status(200).json(new ApiResponse(200, data, "Notification marked as read"));
});

export const markAllNotificationsAsRead = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const data = await notificationService.markAllRead(userId);
    res.status(200).json(new ApiResponse(200, data, "All notifications marked as read"));
});

export const deleteNotification = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const notificationId = req.params.id;
    const data = await notificationService.removeNotification(notificationId, userId);
    res.status(200).json(new ApiResponse(200, data, "Notification deleted successfully"));
});

export const clearReadNotifications = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const data = await notificationService.clearRead(userId);
    res.status(200).json(new ApiResponse(200, data, "Read notifications cleared successfully"));
});

export const createNotification = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const data = await notificationService.createNotification(userId, req.body);
    res.status(201).json(new ApiResponse(201, data, "Notification created successfully"));
});