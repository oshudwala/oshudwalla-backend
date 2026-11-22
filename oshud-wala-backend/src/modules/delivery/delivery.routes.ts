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

// Super Admin assigns ready orders to rider
router.post('/assign', authorizeRoles('SUPER_ADMIN'), validate(assignDeliveriesSchema), c.assignDeliveries);

// Rider endpoints
router.get('/my', authorizeRoles('RIDER'), c.getMyDeliveries);
router.post('/pickup-qr/scan', authorizeRoles('RIDER'), validate(scanPickupQrSchema), c.scanPickupQr);
router.post('/:deliveryId/arrived', authorizeRoles('RIDER'), validate(deliveryIdParamSchema), c.markArrived);
router.post('/:deliveryId/complete', authorizeRoles('RIDER'), validate(completeDeliverySchema), c.completeDelivery);

// Patient reads own in-app delivery OTP (never exposed to rider)
router.get('/order/:orderId/otp', authorizeRoles('PATIENT'), validate(orderIdParamSchema), c.getCustomerDeliveryOtp);

export default router;
