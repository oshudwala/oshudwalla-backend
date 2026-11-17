import { Prisma, RoleName } from '@prisma/client';
import { prisma } from '../../config/prisma';

export const buildUniqueKey = (city: string, area: string | null | undefined, pincode: string) =>
    `${city.trim().toLowerCase()}|${(area ?? '').trim().toLowerCase()}|${pincode}`;

export const findById = (id: string) => prisma.location.findUnique({ where: { id } });

export const findByUniqueKey = (uniqueKey: string) => prisma.location.findUnique({ where: { uniqueKey } });

export const list = async (where: Prisma.LocationWhereInput, page: number, limit: number) => {
    const [items, total] = await prisma.$transaction([
        prisma.location.findMany({
            where,
            orderBy: [{ state: 'asc' }, { city: 'asc' }, { area: 'asc' }],
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.location.count({ where }),
    ]);
    return { items, total };
};

type AuditInput = { actorId: string; actorRole: RoleName; action: string; entityId: string; before?: any; after?: any };

const audit = (tx: Prisma.TransactionClient, a: AuditInput) =>
    tx.auditLog.create({
        data: {
            actorId: a.actorId,
            actorRole: a.actorRole,
            action: a.action,
            entityType: 'Location',
            entityId: a.entityId,
            before: a.before ?? undefined,
            after: a.after ?? undefined,
        },
    });

export const createWithAudit = (data: Prisma.LocationCreateInput, actor: { id: string; role: RoleName }, action: string) =>
    prisma.$transaction(async (tx) => {
        const created = await tx.location.create({ data });
        await audit(tx, { actorId: actor.id, actorRole: actor.role, action, entityId: created.id, after: created });
        return created;
    });

export const updateWithAudit = (
    id: string,
    before: any,
    data: Prisma.LocationUpdateInput,
    actor: { id: string; role: RoleName },
    action: string
) =>
    prisma.$transaction(async (tx) => {
        const updated = await tx.location.update({ where: { id }, data });
        await audit(tx, { actorId: actor.id, actorRole: actor.role, action, entityId: id, before, after: updated });
        return updated;
    });
