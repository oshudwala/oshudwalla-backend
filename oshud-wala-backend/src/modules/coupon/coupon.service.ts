import { RoleName } from '@prisma/client';
import { ApiError } from '../../utils/apiError';
import * as repo from './coupon.repository';

type Actor = { id: string; role: RoleName };

export const createCoupon = async (body: any, actor: Actor) => {
    const code = String(body.code).trim().toUpperCase();
    try {
        return await repo.createCouponTx(
            {
                code,
                description: body.description ? String(body.description).trim() : null,
                discountType: body.discountType,
                discountValue: body.discountValue,
                maxDiscountPaise: body.maxDiscountPaise ?? null,
                minOrderPaise: body.minOrderPaise ?? 0,
                validFrom: new Date(body.validFrom),
                validTo: new Date(body.validTo),
                usageLimitTotal: body.usageLimitTotal ?? null,
                usageLimitPerUser: body.usageLimitPerUser ?? 1,
                isActive: body.isActive ?? true,
            },
            actor
        );
    } catch (error: any) {
        if (error?.code === 'P2002') throw new ApiError(409, 'Coupon code already exists');
        throw new ApiError(500, 'Failed to create coupon');
    }
};

export const listCoupons = async (role: RoleName) => repo.listCoupons(role !== 'SUPER_ADMIN');

export const validateCoupon = async (codeRaw: string, subtotalPaise: number, userId: string) => {
    const code = String(codeRaw).trim().toUpperCase();
    const coupon = await repo.findCouponByCode(code);
    if (!coupon || !coupon.isActive) {
        throw new ApiError(404, `Coupon "${code}" is invalid or inactive`);
    }

    const now = new Date();
    if (now < coupon.validFrom) {
        const fromStr = coupon.validFrom.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
        throw new ApiError(400, `Coupon "${coupon.code}" is not active yet. Valid starting ${fromStr}`);
    }
    if (now > coupon.validTo) {
        const toStr = coupon.validTo.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
        throw new ApiError(400, `Coupon "${coupon.code}" has expired on ${toStr}`);
    }
    if (subtotalPaise < coupon.minOrderPaise) {
        const minRs = Math.round(coupon.minOrderPaise / 100);
        const currRs = Math.round(subtotalPaise / 100);
        throw new ApiError(
            400,
            `Minimum order amount of ₹${minRs} required for coupon "${coupon.code}" (Your order: ₹${currRs})`
        );
    }
    if (coupon.usageLimitTotal !== null && coupon.usedCount >= coupon.usageLimitTotal) {
        throw new ApiError(400, `Coupon "${coupon.code}" has reached its maximum total usage limit`);
    }
    if (coupon.usageLimitPerUser !== null && userId) {
        const userCount = await repo.countUserRedemptions(coupon.id, userId);
        if (userCount >= coupon.usageLimitPerUser) {
            throw new ApiError(
                400,
                `You have already used coupon "${coupon.code}" the maximum allowed ${coupon.usageLimitPerUser} time(s)`
            );
        }
    }

    let discountPaise =
        coupon.discountType === 'PERCENT'
            ? Math.round((subtotalPaise * coupon.discountValue) / 100)
            : coupon.discountValue;

    if (coupon.maxDiscountPaise !== null && discountPaise > coupon.maxDiscountPaise) {
        discountPaise = coupon.maxDiscountPaise;
    }
    if (discountPaise > subtotalPaise) {
        discountPaise = subtotalPaise;
    }

    return {
        couponId: coupon.id,
        code: coupon.code,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        maxDiscountPaise: coupon.maxDiscountPaise,
        minOrderPaise: coupon.minOrderPaise,
        discountPaise,
        discountRupees: discountPaise / 100,
        finalPaise: subtotalPaise - discountPaise,
        finalRupees: (subtotalPaise - discountPaise) / 100,
        validTo: coupon.validTo,
        usageLimitPerUser: coupon.usageLimitPerUser,
    };
};

export const setCouponStatus = async (id: string, isActive: boolean, actor: Actor) => {
    const existing = await repo.findCouponById(id);
    if (!existing) throw new ApiError(404, 'Coupon not found');
    return await repo.updateCouponStatusTx(id, existing, isActive, actor);
};

export const updateCoupon = async (id: string, body: any, actor: Actor) => {
    const existing = await repo.findCouponById(id);
    if (!existing) throw new ApiError(404, 'Coupon not found');
    const data: any = {};
    if (body.description !== undefined) data.description = body.description ? String(body.description).trim() : null;
    if (body.maxDiscountPaise !== undefined) data.maxDiscountPaise = body.maxDiscountPaise;
    if (body.minOrderPaise !== undefined) data.minOrderPaise = body.minOrderPaise;
    if (body.validTo !== undefined) data.validTo = new Date(body.validTo);
    if (body.usageLimitTotal !== undefined) data.usageLimitTotal = body.usageLimitTotal;
    if (body.usageLimitPerUser !== undefined) data.usageLimitPerUser = body.usageLimitPerUser;
    if (body.isActive !== undefined) data.isActive = body.isActive;
    return await repo.updateCouponTx(id, existing, data, actor);
};
