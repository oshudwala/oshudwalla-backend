import { Response } from 'express';
import { RoleName } from '@prisma/client';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { AuthRequest } from '../../middlewares/auth.middleware';
import * as service from './rider.service';

const actorOf = (req: AuthRequest) => ({ id: req.user!.userId, role: req.user!.role as RoleName });

export const createRider = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.createRider(req.body, actorOf(req));
    res.status(201).json(new ApiResponse(201, data, 'Rider account created successfully'));
});

export const listRiders = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.listRiders();
    res.status(200).json(new ApiResponse(200, data, 'Riders retrieved'));
});

export const updateRiderStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.updateRiderStatus(req.params.userId, req.body, actorOf(req));
    res.status(200).json(new ApiResponse(200, data, 'Rider status updated'));
});

export const updateRider = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.updateRider(req.params.id, req.body, actorOf(req));
    res.status(200).json(new ApiResponse(200, data, 'Rider profile updated'));
});
