import { Router } from 'express';
import { authenticate, authorizeRoles } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import * as c from './delivery.controller';
import {
    assignDeliveriesSchema,
    scanPickupQrSchema,
    deliveryIdParamSchema,
    orderIdParamSchema,
    completeDeliverySchema,
} from './delivery.validation';

const router = Router();

router.use(authenticate);

// Super Admin or Pharmacy assigns ready orders to rider
router.post('/assign', authorizeRoles('SUPER_ADMIN', 'PHARMACY'), validate(assignDeliveriesSchema), c.assignDeliveries);

// Fetch active pickup QR for an order (Admin, Pharmacy, Rider)
router.get('/order/:orderId/pickup-qr', authorizeRoles('SUPER_ADMIN', 'PHARMACY', 'RIDER'), validate(orderIdParamSchema), c.getOrderPickupQr);

// Rider endpoints (also authorized for SUPER_ADMIN for testing and verification)
router.get('/my', authorizeRoles('RIDER', 'SUPER_ADMIN'), c.getMyDeliveries);
router.post('/pickup-qr/scan', authorizeRoles('RIDER', 'SUPER_ADMIN'), validate(scanPickupQrSchema), c.scanPickupQr);
router.post('/:deliveryId/arrived', authorizeRoles('RIDER', 'SUPER_ADMIN'), validate(deliveryIdParamSchema), c.markArrived);
router.post('/:deliveryId/complete', authorizeRoles('RIDER', 'SUPER_ADMIN'), validate(completeDeliverySchema), c.completeDelivery);

// Patient reads own in-app delivery OTP (never exposed to rider)
router.get('/order/:orderId/otp', authorizeRoles('PATIENT'), validate(orderIdParamSchema), c.getCustomerDeliveryOtp);

export default router;
