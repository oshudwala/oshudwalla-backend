import { Router } from 'express';
import { registerToken, removeToken, getPreferences, updatePreferences, sendTestPush } from './notification.controller';
import { registerTokenSchema, updatePreferencesSchema } from './notification.validation';
import { validate } from '../../middlewares/validate.middleware';
import { authenticate } from '../../middlewares/auth.middleware';


const router = Router();

/**
 * @swagger
 * tags:
 *   name: Notification
 *   description: Notification & Device Token Management
 */

// Protect all notification routes
router.use(authenticate);

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