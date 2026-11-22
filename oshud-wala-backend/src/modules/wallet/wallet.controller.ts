import { Response } from 'express';
import { RoleName } from '@prisma/client';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { AuthRequest } from '../../middlewares/auth.middleware';
import * as service from './wallet.service';

const actorOf = (req: AuthRequest) => ({ id: req.user!.userId, role: req.user!.role as RoleName });

export const getMyWallet = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.getMyWallet(actorOf(req));
    res.status(200).json(new ApiResponse(200, data, 'Wallet retrieved'));
});

export const requestWithdrawal = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.requestWithdrawal(req.body, actorOf(req));
    res.status(201).json(new ApiResponse(201, data, 'Withdrawal requested and funds held'));
});

export const listWithdrawals = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.listWithdrawals(actorOf(req));
    res.status(200).json(new ApiResponse(200, data, 'Withdrawals retrieved'));
});

export const reviewWithdrawal = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.reviewWithdrawal(req.params.id, req.body, actorOf(req));
    res.status(200).json(new ApiResponse(200, data, 'Withdrawal reviewed'));
});
