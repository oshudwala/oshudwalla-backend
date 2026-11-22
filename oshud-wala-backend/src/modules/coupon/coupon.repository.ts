import { RoleName } from '@prisma/client';
import { prisma } from '../../config/prisma';

type Actor = { id: string; role: RoleName };

export const createCouponTx = (data: any, actor: Actor) =>
    prisma.$transaction(async (tx) => {
        const coupon = await tx.coupon.create({ data });
        await tx.auditLog.create({
            data: { actorId: actor.id, actorRole: actor.role, action: 'COUPON_CREATED', entityType: 'Coupon', entityId: coupon.id, after: coupon as any },
        });
        return coupon;
    });

export const listCoupons = (onlyActive: boolean) => {
    const now = new Date();
    return prisma.coupon.findMany({
        where: onlyActive ? { isActive: true, validFrom: { lte: now }, validTo: { gte: now } } : {},
        orderBy: { createdAt: 'desc' },
    });
};

export const findCouponByCode = (code: string) =>
    prisma.coupon.findUnique({ where: { code } });

export const countUserRedemptions = (couponId: string, userId: string) =>
    prisma.couponRedemption.count({ where: { couponId, userId } });

export const findCouponById = (id: string) =>
    prisma.coupon.findUnique({ where: { id } });

export const updateCouponStatusTx = (id: string, before: any, isActive: boolean, actor: Actor) =>
    prisma.$transaction(async (tx) => {
        const updated = await tx.coupon.update({ where: { id }, data: { isActive } });
        await tx.auditLog.create({
            data: { actorId: actor.id, actorRole: actor.role, action: 'COUPON_STATUS_UPDATED', entityType: 'Coupon', entityId: id, before: { isActive: before.isActive } as any, after: { isActive: updated.isActive } as any },
        });
        return updated;
    });
