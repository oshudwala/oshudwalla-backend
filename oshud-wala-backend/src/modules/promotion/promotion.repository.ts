import { RoleName } from '@prisma/client';
import { prisma } from '../../config/prisma';

type Actor = { id: string; role: RoleName };

let columnsEnsured = false;
export const ensurePromotionColumns = async () => {
    if (columnsEnsured) return;
    try {
        await prisma.$executeRawUnsafe('ALTER TABLE "promotions" ADD COLUMN IF NOT EXISTS "secondaryButtonText" TEXT;');
        await prisma.$executeRawUnsafe('ALTER TABLE "promotions" ADD COLUMN IF NOT EXISTS "secondaryButtonLink" TEXT;');
        columnsEnsured = true;
    } catch (e: any) {
        // Silently continue if columns already exist or DDL is constrained
    }
};

export const listPublicPromotions = async (placement?: string) => {
    await ensurePromotionColumns();
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

export const listAllPromotions = async () => {
    await ensurePromotionColumns();
    return prisma.promotion.findMany({
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
};

export const findById = (id: string) => prisma.promotion.findUnique({ where: { id } });

export const createTx = async (data: any, actor: Actor) => {
    await ensurePromotionColumns();
    try {
        return await prisma.$transaction(async (tx) => {
            const created = await tx.promotion.create({ data });
            await tx.auditLog.create({
                data: { actorId: actor.id, actorRole: actor.role, action: 'PROMOTION_CREATED', entityType: 'Promotion', entityId: created.id, after: created as any },
            });
            return created;
        });
    } catch (err: any) {
        if (err?.message && err.message.includes('secondaryButtonText')) {
            const { secondaryButtonText, secondaryButtonLink, ...safeData } = data;
            return await prisma.$transaction(async (tx) => {
                const created = await tx.promotion.create({ data: safeData });
                await tx.auditLog.create({
                    data: { actorId: actor.id, actorRole: actor.role, action: 'PROMOTION_CREATED', entityType: 'Promotion', entityId: created.id, after: created as any },
                });
                return created;
            });
        }
        throw err;
    }
};

export const updateTx = async (id: string, before: any, data: any, actor: Actor) => {
    await ensurePromotionColumns();
    try {
        return await prisma.$transaction(async (tx) => {
            const updated = await tx.promotion.update({ where: { id }, data });
            await tx.auditLog.create({
                data: { actorId: actor.id, actorRole: actor.role, action: 'PROMOTION_UPDATED', entityType: 'Promotion', entityId: id, before: before as any, after: updated as any },
            });
            return updated;
        });
    } catch (err: any) {
        if (err?.message && err.message.includes('secondaryButtonText')) {
            const { secondaryButtonText, secondaryButtonLink, ...safeData } = data;
            return await prisma.$transaction(async (tx) => {
                const updated = await tx.promotion.update({ where: { id }, data: safeData });
                await tx.auditLog.create({
                    data: { actorId: actor.id, actorRole: actor.role, action: 'PROMOTION_UPDATED', entityType: 'Promotion', entityId: id, before: before as any, after: updated as any },
                });
                return updated;
            });
        }
        throw err;
    }
};

export const deleteTx = (id: string, before: any, actor: Actor) =>
    prisma.$transaction(async (tx) => {
        await tx.promotion.delete({ where: { id } });
        await tx.auditLog.create({
            data: { actorId: actor.id, actorRole: actor.role, action: 'PROMOTION_DELETED', entityType: 'Promotion', entityId: id, before: before as any },
        });
    });
