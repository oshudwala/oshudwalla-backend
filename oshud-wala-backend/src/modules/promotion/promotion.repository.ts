import { RoleName } from '@prisma/client';
import { prisma } from '../../config/prisma';

type Actor = { id: string; role: RoleName };

export const listPublicPromotions = (placement?: string) => {
    const now = new Date();
    return prisma.promotion.findMany({
        where: {
            isActive: true,
            ...(placement ? { placement } : {}),
            AND: [
                { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
                { OR: [{ validTo: null }, { validTo: { gte: now } }] },
            ],
        },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
};

export const listAllPromotions = () =>
    prisma.promotion.findMany({
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });

export const findById = (id: string) => prisma.promotion.findUnique({ where: { id } });

export const createTx = (data: any, actor: Actor) =>
    prisma.$transaction(async (tx) => {
        const created = await tx.promotion.create({ data });
        await tx.auditLog.create({
            data: { actorId: actor.id, actorRole: actor.role, action: 'PROMOTION_CREATED', entityType: 'Promotion', entityId: created.id, after: created as any },
        });
        return created;
    });

export const updateTx = (id: string, before: any, data: any, actor: Actor) =>
    prisma.$transaction(async (tx) => {
        const updated = await tx.promotion.update({ where: { id }, data });
        await tx.auditLog.create({
            data: { actorId: actor.id, actorRole: actor.role, action: 'PROMOTION_UPDATED', entityType: 'Promotion', entityId: id, before: before as any, after: updated as any },
        });
        return updated;
    });

export const deleteTx = (id: string, before: any, actor: Actor) =>
    prisma.$transaction(async (tx) => {
        await tx.promotion.delete({ where: { id } });
        await tx.auditLog.create({
            data: { actorId: actor.id, actorRole: actor.role, action: 'PROMOTION_DELETED', entityType: 'Promotion', entityId: id, before: before as any },
        });
    });
