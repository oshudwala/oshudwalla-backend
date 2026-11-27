import { Request, Response } from 'express';
import { RoleName } from '@prisma/client';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import * as announcementService from './announcement.service';

export const getActiveAnnouncements = asyncHandler(async (req: Request, res: Response) => {
    const role = req.query.role ? String(req.query.role) : undefined;
    const announcements = await announcementService.fetchActiveAnnouncements(role);
    res.status(200).json(new ApiResponse(200, announcements, 'Active announcements fetched'));
});

export const getAdminAnnouncements = asyncHandler(async (_req: AuthRequest, res: Response) => {
    const announcements = await announcementService.fetchAllAnnouncementsForAdmin();
    res.status(200).json(new ApiResponse(200, announcements, 'All announcements fetched'));
});

export const createAnnouncement = asyncHandler(async (req: AuthRequest, res: Response) => {
    const actor = { id: req.user!.userId, role: req.user!.role as RoleName };
    const created = await announcementService.createAnnouncement(req.body, actor);
    res.status(201).json(new ApiResponse(201, created, 'Announcement broadcasted successfully'));
});

export const updateAnnouncement = asyncHandler(async (req: AuthRequest, res: Response) => {
    const actor = { id: req.user!.userId, role: req.user!.role as RoleName };
    const updated = await announcementService.updateAnnouncement(req.params.id, req.body, actor);
    res.status(200).json(new ApiResponse(200, updated, 'Announcement updated successfully'));
});

export const deleteAnnouncement = asyncHandler(async (req: AuthRequest, res: Response) => {
    const actor = { id: req.user!.userId, role: req.user!.role as RoleName };
    const result = await announcementService.deleteAnnouncement(req.params.id, actor);
    res.status(200).json(new ApiResponse(200, result, 'Announcement deleted successfully'));
});
