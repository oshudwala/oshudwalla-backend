import { Router } from 'express';
import { authenticate, authorizeRoles } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import * as announcementController from './announcement.controller';
import {
    createAnnouncementSchema,
    updateAnnouncementSchema,
    announcementIdParamSchema,
} from './announcement.validation';

const router = Router();

// Public / All portals: fetch active, non-expired announcements (optional ?role=PATIENT|DOCTOR|PHARMACY|RECEPTIONIST|RIDER)
router.get('/', announcementController.getActiveAnnouncements);

// Super Admin: list all announcements (including inactive & expired)
router.get(
    '/admin',
    authenticate,
    authorizeRoles('SUPER_ADMIN'),
    announcementController.getAdminAnnouncements
);

// Super Admin: create & broadcast a new announcement
router.post(
    '/',
    authenticate,
    authorizeRoles('SUPER_ADMIN'),
    validate(createAnnouncementSchema),
    announcementController.createAnnouncement
);

// Super Admin: update or pause/resume an announcement
router.patch(
    '/:id',
    authenticate,
    authorizeRoles('SUPER_ADMIN'),
    validate(updateAnnouncementSchema),
    announcementController.updateAnnouncement
);

// Super Admin: delete an announcement
router.delete(
    '/:id',
    authenticate,
    authorizeRoles('SUPER_ADMIN'),
    validate(announcementIdParamSchema),
    announcementController.deleteAnnouncement
);

export default router;
