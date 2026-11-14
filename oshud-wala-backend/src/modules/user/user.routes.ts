import { Router } from 'express';
import { getMyProfile, updateMyProfile } from './user.controller';
import { validate } from '../../middlewares/validate.middleware';
import { updateProfileSchema } from './user.validation';
import { authenticate } from '../../middlewares/auth.middleware';
import { addNewAddress, getMyAddresses, editAddress, deleteAddress } from './address.controller';
import { createAddressSchema, updateAddressSchema } from './address.validation';

const router = Router();

// Protect all user routes
router.use(authenticate);

/**
 * @swagger
 * tags:
 *   name: User
 *   description: User Profile and Address Management
 */

/**
 * @swagger
 * /users/profile:
 *   get:
 *     tags: [User]
 *     summary: Get current user's profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 */
router.get('/profile', getMyProfile);

/**
 * @swagger
 * /users/profile:
 *   put:
 *     tags: [User]
 *     summary: Update current user's profile (including patient details)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName: { type: string }
 *               email: { type: string }
 *               dateOfBirth: { type: string, format: date-time }
 *               gender: { type: string, enum: [MALE, FEMALE, OTHER] }
 *               bloodGroup: { type: string }
 *               allergies: { type: string }
 *               medicalNotes: { type: string }
 *     responses:
 *       200:
 *         description: Profile updated successfully
 */
router.put('/profile', validate(updateProfileSchema), updateMyProfile);


/**
 * @swagger
 * /users/addresses:
 *   post:
 *     tags: [User]
 *     summary: Add a new address
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fullName, phone, line1, city, state, pincode]
 *             properties:
 *               label: { type: string, example: "Home" }
 *               fullName: { type: string }
 *               phone: { type: string }
 *               line1: { type: string }
 *               line2: { type: string }
 *               landmark: { type: string }
 *               city: { type: string }
 *               state: { type: string }
 *               pincode: { type: string }
 *               isDefault: { type: boolean }
 *     responses:
 *       201:
 *         description: Address created successfully
 */
router.post('/addresses', validate(createAddressSchema), addNewAddress);

/**
 * @swagger
 * /users/addresses:
 *   get:
 *     tags: [User]
 *     summary: Get all active addresses of the user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Addresses retrieved successfully
 */
router.get('/addresses', getMyAddresses);

// Edit Address
router.put('/addresses/:id', validate(updateAddressSchema), editAddress);

// Soft Delete Address
router.delete('/addresses/:id', deleteAddress);

export default router;