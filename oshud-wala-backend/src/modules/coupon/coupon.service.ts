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
                usageLimitPerUser: body.usageLimitPerUser ?? null,
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
    if (!coupon || !coupon.isActive) throw new ApiError(404, 'Invalid or inactive coupon');

    const now = new Date();
    if (now < coupon.validFrom || now > coupon.validTo) {
        throw new ApiError(400, 'Coupon is expired or not yet active');
    }
    if (subtotalPaise < coupon.minOrderPaise) {
        throw new ApiError(400, `Minimum order amount is ${coupon.minOrderPaise} paise`);
    }
    if (coupon.usageLimitTotal !== null && coupon.usedCount >= coupon.usageLimitTotal) {
        throw new ApiError(400, 'Coupon usage limit reached');
    }
    if (coupon.usageLimitPerUser !== null) {
        const userCount = await repo.countUserRedemptions(coupon.id, userId);
        if (userCount >= coupon.usageLimitPerUser) {
            throw new ApiError(400, 'You have already used this coupon the maximum number of times');
        }
    }

    let discountPaise =
        coupon.discountType === 'PERCENT'
            ? Math.floor((subtotalPaise * coupon.discountValue) / 100)
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
        discountPaise,
        finalPaise: subtotalPaise - discountPaise,
    };
};

export const setCouponStatus = async (id: string, isActive: boolean, actor: Actor) => {
    const existing = await repo.findCouponById(id);
    if (!existing) throw new ApiError(404, 'Coupon not found');
    return await repo.updateCouponStatusTx(id, existing, isActive, actor);
};
