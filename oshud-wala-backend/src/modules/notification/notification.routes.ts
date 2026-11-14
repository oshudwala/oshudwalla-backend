import { Router } from 'express';
import { registerToken, removeToken } from './notification.controller';
import { validate } from '../../middlewares/validate.middleware';
import { registerTokenSchema } from './notification.validation';
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

export default router;