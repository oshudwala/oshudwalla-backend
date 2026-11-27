import { RoleName } from '@prisma/client';
import { prisma } from '../../config/prisma';

export type Actor = { id: string; role: RoleName };

export const findActiveAnnouncements = (role?: string | null) => {
    const now = new Date();
    const where: any = {
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    };

    if (role) {
        where.targetRoles = { hasSome: ['ALL', role] };
    }

    return prisma.announcement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 50,
    });
};

export const findAllAnnouncementsAdmin = () =>
    prisma.announcement.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100,
    });

export const findAnnouncementById = (id: string) =>
    prisma.announcement.findUnique({
        where: { id },
    });

export const createAnnouncementWithAudit = (
    data: {
        title: string;
        message: string;
        priority: string;
        targetRoles: string[];
        isActive: boolean;
        expiresAt: Date | null;
        createdById: string;
    },
    actor: Actor
) =>
    prisma.$transaction(
        async (tx) => {
            const created = await tx.announcement.create({ data });

            await tx.auditLog.create({
                data: {
                    actorId: actor.id,
                    actorRole: actor.role,
                    action: 'ANNOUNCEMENT_CREATED',
                    entityType: 'Announcement',
                    entityId: created.id,
                    after: created as any,
                },
            });

            return created;
        },
        { maxWait: 10000, timeout: 30000 }
    );

export const updateAnnouncementWithAudit = (
    id: string,
    before: any,
    data: any,
    actor: Actor
) =>
    prisma.$transaction(
        async (tx) => {
            const updated = await tx.announcement.update({
                where: { id },
                data,
            });

            await tx.auditLog.create({
                data: {
                    actorId: actor.id,
                    actorRole: actor.role,
                    action: 'ANNOUNCEMENT_UPDATED',
                    entityType: 'Announcement',
                    entityId: id,
                    before: before as any,
                    after: updated as any,
                },
            });

            return updated;
        },
        { maxWait: 10000, timeout: 30000 }
    );

export const deleteAnnouncementWithAudit = (existing: any, actor: Actor) =>
    prisma.$transaction(
        async (tx) => {
            await tx.announcement.delete({
                where: { id: existing.id },
            });

            await tx.auditLog.create({
                data: {
                    actorId: actor.id,
                    actorRole: actor.role,
                    action: 'ANNOUNCEMENT_DELETED',
                    entityType: 'Announcement',
                    entityId: existing.id,
                    before: existing as any,
                },
            });

            return { deleted: true };
        },
        { maxWait: 10000, timeout: 30000 }
    );
