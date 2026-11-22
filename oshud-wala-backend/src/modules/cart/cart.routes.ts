import { Router } from 'express';
import { authenticate, authorizeRoles } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import * as c from './cart.controller';
import { addCartItemSchema, updateCartItemSchema, removeCartItemSchema } from './cart.validation';

const router = Router();

router.use(authenticate, authorizeRoles('PATIENT'));

router.get('/', c.getCart);
router.post('/items', validate(addCartItemSchema), c.addCartItem);
router.put('/items/:productId', validate(updateCartItemSchema), c.updateCartItem);
router.delete('/items/:productId', validate(removeCartItemSchema), c.removeCartItem);
router.delete('/', c.clearCart);

export default router;
