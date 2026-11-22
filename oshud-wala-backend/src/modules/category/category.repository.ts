import { RoleName } from '@prisma/client';
import { prisma } from '../../config/prisma';

type Actor = { id: string; role: RoleName };

export const findById = (id: string) => prisma.category.findUnique({ where: { id } });

export const listActive = (parentId?: string | null) =>
    prisma.category.findMany({
        where: { isActive: true, ...(parentId !== undefined ? { parentId } : {}) },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

export const createWithAudit = (data: any, actor: Actor) =>
    prisma.$transaction(async (tx) => {
        const created = await tx.category.create({ data });
        await tx.auditLog.create({
            data: { actorId: actor.id, actorRole: actor.role, action: 'CATEGORY_CREATED', entityType: 'Category', entityId: created.id, after: created as any },
        });
        return created;
    });

export const updateWithAudit = (id: string, before: any, data: any, actor: Actor) =>
    prisma.$transaction(async (tx) => {
        const updated = await tx.category.update({ where: { id }, data });
        await tx.auditLog.create({
            data: { actorId: actor.id, actorRole: actor.role, action: 'CATEGORY_UPDATED', entityType: 'Category', entityId: id, before: before as any, after: updated as any },
        });
        return updated;
    });
