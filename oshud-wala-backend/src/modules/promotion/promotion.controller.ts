import { Response } from 'express';
import { RoleName } from '@prisma/client';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { AuthRequest } from '../../middlewares/auth.middleware';
import * as service from './promotion.service';

const actorOf = (req: AuthRequest) => ({ id: req.user!.userId, role: req.user!.role as RoleName });

export const listPublicPromotions = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.listPublic(req.query.placement as string | undefined);
    res.status(200).json(new ApiResponse(200, data, 'Active promotions retrieved'));
});

export const listAdminPromotions = asyncHandler(async (_req: AuthRequest, res: Response) => {
    const data = await service.listAdmin();
    res.status(200).json(new ApiResponse(200, data, 'All promotions retrieved'));
});

export const createPromotion = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.createPromotion(req.body, actorOf(req));
    res.status(201).json(new ApiResponse(201, data, 'Promotion created'));
});

export const updatePromotion = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.updatePromotion(req.params.id, req.body, actorOf(req));
    res.status(200).json(new ApiResponse(200, data, 'Promotion updated'));
});

export const deletePromotion = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.deletePromotion(req.params.id, actorOf(req));
    res.status(200).json(new ApiResponse(200, data, 'Promotion deleted'));
});
