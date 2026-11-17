import { Router } from 'express';
import { validate } from '../../middlewares/validate.middleware';
import { authenticate, authorizeRoles } from '../../middlewares/auth.middleware';
import * as c from './location.controller';
import {
    createLocationSchema,
    updateLocationSchema,
    setLocationStatusSchema,
    listLocationSchema,
} from './location.validation';

const router = Router();

// ---- Public (no login): patients choose a location first ----
router.get('/', validate(listLocationSchema), c.listPublic);

// ---- SUPER_ADMIN only (declared before '/:id' so '/admin/all' is not treated as an id) ----
router.get('/admin/all', authenticate, authorizeRoles('SUPER_ADMIN'), validate(listLocationSchema), c.listAdmin);
router.post('/', authenticate, authorizeRoles('SUPER_ADMIN'), validate(createLocationSchema), c.create);
router.put('/:id', authenticate, authorizeRoles('SUPER_ADMIN'), validate(updateLocationSchema), c.update);
router.patch('/:id/status', authenticate, authorizeRoles('SUPER_ADMIN'), validate(setLocationStatusSchema), c.setStatus);

// Public single location (active only)
router.get('/:id', c.getPublic);

export default router;
