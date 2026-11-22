import { Router } from 'express';
import { authenticate, authorizeRoles } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import * as c from './product.controller';
import { createProductSchema, updateProductSchema, listProductsSchema, getProductSchema } from './product.validation';

const router = Router();

router.get('/', validate(listProductsSchema), c.listProducts);
router.get('/:id', validate(getProductSchema), c.getProduct);
router.post('/', authenticate, authorizeRoles('SUPER_ADMIN'), validate(createProductSchema), c.createProduct);
router.put('/:id', authenticate, authorizeRoles('SUPER_ADMIN'), validate(updateProductSchema), c.updateProduct);

export default router;
