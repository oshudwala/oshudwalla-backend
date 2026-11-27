import { Router } from 'express';
import { authenticate, authorizeRoles } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import * as c from './order.controller';
import {
    createOrderSchema,
    createWalkInOrderSchema,
    updateOrderStatusSchema,
    cancelOrderSchema,
    orderPharmacyParamSchema,
} from './order.validation';

const router = Router();

router.use(authenticate);

router.post('/', authorizeRoles('PATIENT'), validate(createOrderSchema), c.placeOrder);
router.post('/walk-in', authorizeRoles('SUPER_ADMIN', 'PHARMACY'), validate(createWalkInOrderSchema), c.createWalkInOrder);
router.get('/', authorizeRoles('SUPER_ADMIN', 'PHARMACY'), c.getPharmacyOrdersForCurrentUser);
router.get('/my', authorizeRoles('PATIENT'), c.getMyOrders);
router.get('/pharmacy/:pharmacyId', authorizeRoles('SUPER_ADMIN', 'PHARMACY'), validate(orderPharmacyParamSchema), c.getPharmacyOrders);
router.patch('/:id/status', authorizeRoles('SUPER_ADMIN', 'PHARMACY'), validate(updateOrderStatusSchema), c.updateOrderStatus);
router.patch('/:id/cancel', authorizeRoles('PATIENT', 'SUPER_ADMIN'), validate(cancelOrderSchema), c.cancelOrder);
router.get('/:id/invoice.pdf', authorizeRoles('PATIENT', 'PHARMACY', 'SUPER_ADMIN'), c.downloadOrderInvoicePdf);

export default router;
