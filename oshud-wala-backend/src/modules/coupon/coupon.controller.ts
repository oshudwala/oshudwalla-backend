import { Response } from 'express';
import { RoleName } from '@prisma/client';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { AuthRequest } from '../../middlewares/auth.middleware';
import * as service from './coupon.service';

const actorOf = (req: AuthRequest) => ({ id: req.user!.userId, role: req.user!.role as RoleName });

export const createCoupon = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.createCoupon(req.body, actorOf(req));
    res.status(201).json(new ApiResponse(201, data, 'Coupon created'));
});

export const listCoupons = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.listCoupons(req.user!.role as RoleName);
    res.status(200).json(new ApiResponse(200, data, 'Coupons retrieved'));
});

export const validateCoupon = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.validateCoupon(req.body.code, req.body.subtotalPaise, req.user!.userId);
    res.status(200).json(new ApiResponse(200, data, 'Coupon is valid'));
});

export const updateCouponStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.setCouponStatus(req.params.id, req.body.isActive, actorOf(req));
    res.status(200).json(new ApiResponse(200, data, 'Coupon status updated'));
});

export const updateCoupon = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.updateCoupon(req.params.id, req.body, actorOf(req));
    res.status(200).json(new ApiResponse(200, data, 'Coupon updated'));
});
