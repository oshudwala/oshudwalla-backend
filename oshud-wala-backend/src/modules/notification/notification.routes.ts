import { Router } from 'express';
import {
    registerToken,
    removeToken,
    getPreferences,
    updatePreferences,
    sendTestPush,
    getMyNotifications,
    getUnreadCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification,
    clearReadNotifications,
    createNotification,
} from './notification.controller';
import { registerTokenSchema, updatePreferencesSchema } from './notification.validation';
import { validate } from '../../middlewares/validate.middleware';
import { authenticate } from '../../middlewares/auth.middleware';

const router = Router();

// Protect all notification routes
router.use(authenticate);

// ---------------------------------------------------------------------------
// IN-APP NOTIFICATIONS (Strictly isolated by authenticated userId)
// ---------------------------------------------------------------------------

// Get current user's dedicated notifications
router.get('/', getMyNotifications);

// Get current user's unread count
router.get('/unread-count', getUnreadCount);

// Mark all notifications as read for current user
router.patch('/read-all', markAllNotificationsAsRead);
router.post('/read-all', markAllNotificationsAsRead);
router.put('/read-all', markAllNotificationsAsRead);

// Clear all read notifications for current user
router.delete('/', clearReadNotifications);

// Create an in-app notification
router.post('/', createNotification);

// Mark specific notification as read (scoped to current user)
router.patch('/:id/read', markNotificationAsRead);
router.put('/:id/read', markNotificationAsRead);

// Delete specific notification (scoped to current user)
router.delete('/:id', deleteNotification);

/**
 * @swagger
 * /notifications/device-token:
 *   post:
 *     tags: [Notification]
 *     summary: Register or update a device FCM token
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fcmToken, deviceType]
 *             properties:
 *               fcmToken: { type: string, example: "abc123token_test" }
 *               deviceType: { type: string, enum: [ANDROID, IOS, WEB], example: "ANDROID" }
 *               deviceId: { type: string, example: "device_123" }
 *     responses:
 *       200:
 *         description: Device token registered successfully
 */
router.post('/device-token', validate(registerTokenSchema), registerToken);

/**
 * @swagger
 * /notifications/device-token/remove:
 *   post:
 *     tags: [Notification]
 *     summary: Remove a device FCM token
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fcmToken]
 *             properties:
 *               fcmToken: { type: string, example: "abc123token_test" }
 *     responses:
 *       200:
 *         description: Device token removed successfully
 */
router.post('/device-token/remove', removeToken);



// GET and PUT preferences
/**
 * @swagger
 * /notifications/preferences:
 *   get:
 *     tags: [Notification]
 *     summary: Get user's notification preferences
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Preferences retrieved successfully
 */
router.get('/preferences', getPreferences);

/**
 * @swagger
 * /notifications/preferences:
 *   put:
 *     tags: [Notification]
 *     summary: Update user's notification preferences
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               globalSettings:
 *                 type: object
 *                 properties:
 *                   pushEnabled: { type: boolean }
 *                   quietStartMinute: { type: number, nullable: true }
 *                   quietEndMinute: { type: number, nullable: true }
 *                   timezone: { type: string }
 *               categories:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     category: { type: string, example: "ORDER" }
 *                     pushEnabled: { type: boolean }
 *                     inAppEnabled: { type: boolean }
 *     responses:
 *       200:
 *         description: Preferences updated successfully
 */
router.put('/preferences', validate(updatePreferencesSchema), updatePreferences);

router.post('/test-push', sendTestPush);

export default router;