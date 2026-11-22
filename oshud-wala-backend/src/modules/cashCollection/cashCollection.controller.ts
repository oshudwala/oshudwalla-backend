import { Response } from 'express';
import { RoleName } from '@prisma/client';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { AuthRequest } from '../../middlewares/auth.middleware';
import * as service from './cashCollection.service';

const actorOf = (req: AuthRequest) => ({ id: req.user!.userId, role: req.user!.role as RoleName });

export const getMyCash = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.getMyCash(req.user!.userId);
    res.status(200).json(new ApiResponse(200, data, 'COD cash collections retrieved'));
});

export const submitDeposit = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.submitDeposit(req.user!.userId, req.body);
    res.status(201).json(new ApiResponse(201, data, 'COD cash deposit submitted for verification'));
});

export const verifyDeposit = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.verifyDeposit(req.params.id, req.body, actorOf(req));
    res.status(200).json(new ApiResponse(200, data, 'COD cash deposit reviewed'));
});
