import { Response } from 'express';
import { RoleName } from '@prisma/client';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { AuthRequest } from '../../middlewares/auth.middleware';
import * as service from './order.service';

const actorOf = (req: AuthRequest) => ({ id: req.user!.userId, role: req.user!.role as RoleName });

export const placeOrder = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.placeOrder(req.body, actorOf(req));
    res.status(201).json(new ApiResponse(201, data, 'COD order placed successfully'));
});

export const getMyOrders = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.getMyOrders(req.user!.userId);
    res.status(200).json(new ApiResponse(200, data, 'Your orders retrieved'));
});

export const getPharmacyOrders = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.getPharmacyOrders(req.params.pharmacyId, actorOf(req));
    res.status(200).json(new ApiResponse(200, data, 'Pharmacy orders retrieved'));
});

export const updateOrderStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.updateOrderStatus(req.params.id, req.body.status, req.body.reason, actorOf(req));
    res.status(200).json(new ApiResponse(200, data, 'Order status updated'));
});

export const cancelOrder = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.cancelOrder(req.params.id, req.body.cancelReason, actorOf(req));
    res.status(200).json(new ApiResponse(200, data, 'Order cancelled'));
});
import { streamOrderInvoicePdf } from './order.invoice';

export const downloadInvoicePdf = asyncHandler(async (req: AuthRequest, res: Response) => {
    await streamOrderInvoicePdf(req.params.id, req.user!.userId, req.user!.role, res);
});
