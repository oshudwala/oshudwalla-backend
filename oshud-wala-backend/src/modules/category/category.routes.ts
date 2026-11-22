import { Router } from 'express';
import { authenticate, authorizeRoles } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import * as c from './category.controller';
import { createCategorySchema, updateCategorySchema } from './category.validation';

const router = Router();

router.get('/', c.listCategories);
router.post('/', authenticate, authorizeRoles('SUPER_ADMIN'), validate(createCategorySchema), c.createCategory);
router.put('/:id', authenticate, authorizeRoles('SUPER_ADMIN'), validate(updateCategorySchema), c.updateCategory);

export default router;
