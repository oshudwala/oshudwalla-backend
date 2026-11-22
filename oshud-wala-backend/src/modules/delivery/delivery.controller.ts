import { Response } from 'express';
import { RoleName } from '@prisma/client';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { AuthRequest } from '../../middlewares/auth.middleware';
import * as service from './delivery.service';

const actorOf = (req: AuthRequest) => ({ id: req.user!.userId, role: req.user!.role as RoleName });

export const assignDeliveries = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.assignDeliveries(req.body.riderId, req.body.orderIds, actorOf(req));
    res.status(201).json(new ApiResponse(201, data, 'Orders assigned to rider and Pickup QR generated'));
});

export const getMyDeliveries = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.getMyDeliveries(req.user!.userId);
    res.status(200).json(new ApiResponse(200, data, 'Assigned deliveries retrieved'));
});

export const scanPickupQr = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.scanPickupQr(req.body.qrToken, actorOf(req));
    res.status(200).json(new ApiResponse(200, data, 'Pickup QR verified and orders picked up'));
});

export const markArrived = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.markArrived(req.params.deliveryId, actorOf(req));
    res.status(200).json(new ApiResponse(200, data, 'Arrived at customer location. In-app delivery OTP generated.'));
});

export const getCustomerDeliveryOtp = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.getCustomerDeliveryOtp(req.params.orderId, req.user!.userId);
    res.status(200).json(new ApiResponse(200, data, 'Delivery OTP retrieved'));
});

export const completeDelivery = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.completeDelivery(req.params.deliveryId, req.body.otp, actorOf(req));
    res.status(200).json(new ApiResponse(200, data, 'Delivery completed and ₹40 credited to rider wallet'));
});
