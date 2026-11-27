import { ApiError } from '../../utils/apiError';
import * as announcementRepo from './announcement.repository';

type Actor = announcementRepo.Actor;

export const fetchActiveAnnouncements = async (role?: string) => {
    const normalizedRole = role ? String(role).trim().toUpperCase() : null;
    return await announcementRepo.findActiveAnnouncements(normalizedRole);
};

export const fetchAllAnnouncementsForAdmin = async () => {
    return await announcementRepo.findAllAnnouncementsAdmin();
};

export const createAnnouncement = async (body: any, actor: Actor) => {
    const uniqueRoles = Array.from(new Set<string>(body.targetRoles ?? ['ALL']));

    try {
        return await announcementRepo.createAnnouncementWithAudit(
            {
                title: String(body.title).trim(),
                message: String(body.message).trim(),
                priority: body.priority ?? 'INFO',
                targetRoles: uniqueRoles,
                isActive: body.isActive ?? true,
                expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
                createdById: actor.id,
            },
            actor
        );
    } catch (error: any) {
        if (error instanceof ApiError) throw error;
        console.error('Create announcement error:', error);
        throw new ApiError(500, 'Failed to create announcement');
    }
};

export const updateAnnouncement = async (id: string, body: any, actor: Actor) => {
    const existing = await announcementRepo.findAnnouncementById(id);
    if (!existing) throw new ApiError(404, 'Announcement not found');

    const data: any = {};
    if (body.title !== undefined) data.title = String(body.title).trim();
    if (body.message !== undefined) data.message = String(body.message).trim();
    if (body.priority !== undefined) data.priority = body.priority;
    if (body.targetRoles !== undefined) data.targetRoles = Array.from(new Set<string>(body.targetRoles));
    if (body.isActive !== undefined) data.isActive = body.isActive;
    if (body.expiresAt !== undefined) {
        data.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
    }

    try {
        return await announcementRepo.updateAnnouncementWithAudit(id, existing, data, actor);
    } catch (error: any) {
        if (error instanceof ApiError) throw error;
        console.error('Update announcement error:', error);
        throw new ApiError(500, 'Failed to update announcement');
    }
};

export const deleteAnnouncement = async (id: string, actor: Actor) => {
    const existing = await announcementRepo.findAnnouncementById(id);
    if (!existing) throw new ApiError(404, 'Announcement not found');

    try {
        return await announcementRepo.deleteAnnouncementWithAudit(existing, actor);
    } catch (error: any) {
        if (error instanceof ApiError) throw error;
        console.error('Delete announcement error:', error);
        throw new ApiError(500, 'Failed to delete announcement');
    }
};
