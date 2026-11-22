import { Prisma, RoleName } from '@prisma/client';
import { prisma } from '../../config/prisma';

type Actor = { id: string; role: RoleName };

export const findById = (id: string) =>
    prisma.product.findUnique({ where: { id }, include: { category: { select: { id: true, name: true, slug: true } } } });

export const findCategoryById = (id: string) => prisma.category.findUnique({ where: { id } });

export const list = async (where: Prisma.ProductWhereInput, page: number, limit: number) => {
    const [items, total] = await prisma.$transaction([
        prisma.product.findMany({
            where,
            orderBy: { name: 'asc' },
            skip: (page - 1) * limit,
            take: limit,
            include: { category: { select: { id: true, name: true, slug: true } } },
        }),
        prisma.product.count({ where }),
    ]);
    return { items, total };
};

export const createWithAudit = (data: any, actor: Actor) =>
    prisma.$transaction(async (tx) => {
        const created = await tx.product.create({
            data,
            include: { category: { select: { id: true, name: true, slug: true } } },
        });
        await tx.auditLog.create({
            data: { actorId: actor.id, actorRole: actor.role, action: 'PRODUCT_CREATED', entityType: 'Product', entityId: created.id, after: created as any },
        });
        return created;
    });

export const updateWithAudit = (id: string, before: any, data: any, actor: Actor) =>
    prisma.$transaction(async (tx) => {
        const updated = await tx.product.update({
            where: { id },
            data,
            include: { category: { select: { id: true, name: true, slug: true } } },
        });
        await tx.auditLog.create({
            data: { actorId: actor.id, actorRole: actor.role, action: 'PRODUCT_UPDATED', entityType: 'Product', entityId: id, before: before as any, after: updated as any },
        });
        return updated;
    });
