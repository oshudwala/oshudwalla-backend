import { Router } from 'express';
import { authenticate, authorizeRoles } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import * as c from './promotion.controller';
import { createPromotionSchema, updatePromotionSchema, promotionIdParamSchema } from './promotion.validation';

const router = Router();

// Public: home page top banners sorted by sortOrder ASC
router.get('/', c.listPublicPromotions);

// Super Admin management
router.get('/admin', authenticate, authorizeRoles('SUPER_ADMIN'), c.listAdminPromotions);
router.post('/', authenticate, authorizeRoles('SUPER_ADMIN'), validate(createPromotionSchema), c.createPromotion);
router.put('/:id', authenticate, authorizeRoles('SUPER_ADMIN'), validate(updatePromotionSchema), c.updatePromotion);
router.delete('/:id', authenticate, authorizeRoles('SUPER_ADMIN'), validate(promotionIdParamSchema), c.deletePromotion);

export default router;
