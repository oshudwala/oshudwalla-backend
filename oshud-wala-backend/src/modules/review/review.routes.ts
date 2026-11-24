import { Router } from 'express';
import { authenticate, authorizeRoles } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { upsertReviewSchema } from './review.validation';
import * as c from './review.controller';

const router = Router();

// Public: anyone can view ratings & reviews
router.get('/pharmacy/:pharmacyId', c.getPharmacyReviews);
router.get('/doctor/:doctorId', c.getDoctorReviews);

// Protected: Patient submits/updates 1-5 star rating
router.post('/', authenticate, authorizeRoles('PATIENT'), validate(upsertReviewSchema), c.submitReview);
router.delete('/:id', authenticate, authorizeRoles('PATIENT', 'SUPER_ADMIN'), c.deleteReview);

export default router;
