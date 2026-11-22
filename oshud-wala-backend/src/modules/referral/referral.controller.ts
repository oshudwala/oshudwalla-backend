import { Response } from 'express';
import { RoleName } from '@prisma/client';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { AuthRequest } from '../../middlewares/auth.middleware';
import * as service from './referral.service';

const actorOf = (req: AuthRequest) => ({ id: req.user!.userId, role: req.user!.role as RoleName });

export const getMyReferral = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.getMyReferralSummary(req.user!.userId);
    res.status(200).json(new ApiResponse(200, data, 'Referral & coin balance retrieved'));
});

export const applyReferral = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.applyReferral(req.user!.userId, req.body.referrerId);
    res.status(201).json(new ApiResponse(201, data, 'Referral applied'));
});

export const rewardReferral = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.rewardReferral(req.params.id, req.body.rewardCoins ?? 50, actorOf(req));
    res.status(200).json(new ApiResponse(200, data, 'Referral rewarded and coins credited'));
});
