import { Router } from 'express';
import { register, login, refresh, logout } from './auth.controller';
import { validate } from '../../middlewares/validate.middleware';
import { registerSchema, loginSchema, refreshSchema } from './auth.validation';
import { authenticate } from '../../middlewares/auth.middleware';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication & Session Management
 */

/**
 * @swagger
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new patient account
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fullName, phone, password]
 *             properties:
 *               fullName: { type: string, example: "Test Patient" }
 *               phone: { type: string, example: "9876543210" }
 *               email: { type: string, example: "test@oshudwala.com" }
 *               password: { type: string, example: "Password123" }
 *     responses:
 *       201:
 *         description: User registered successfully
 */
router.post('/register', validate(registerSchema), register);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login to account
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [identifier, password]
 *             properties:
 *               identifier: { type: string, example: "9876543210" }
 *               password: { type: string, example: "Password123" }
 *     responses:
 *       200:
 *         description: Login successful, returns tokens
 */
router.post('/login', validate(loginSchema), login);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Refresh access and refresh tokens
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken, sessionId]
 *             properties:
 *               refreshToken: { type: string }
 *               sessionId: { type: string }
 *     responses:
 *       200:
 *         description: Tokens refreshed successfully
 */
router.post('/refresh', validate(refreshSchema), refresh);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Logout and revoke session
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sessionId]
 *             properties:
 *               sessionId: { type: string }
 *     responses:
 *       200:
 *         description: Logged out successfully
 */
router.post('/logout', authenticate, logout);

export default router;