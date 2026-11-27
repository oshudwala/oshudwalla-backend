import { Response } from 'express';
import { RoleName } from '@prisma/client';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { AuthRequest } from '../../middlewares/auth.middleware';
import * as service from './prescription.service';

const actorOf = (req: AuthRequest) => ({ id: req.user!.userId, role: req.user!.role as RoleName });

export const submitPrescription = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.submitPrescription(req.body, actorOf(req));
    res.status(201).json(new ApiResponse(201, data, 'Prescription submitted (auto-expires in 48 hours)'));
});

export const getMyPrescriptions = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.getMyPrescriptions(req.user!.userId);
    res.status(200).json(new ApiResponse(200, data, 'Your prescriptions retrieved'));
});

export const getPharmacyPrescriptions = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.getPharmacyPrescriptions(req.params.pharmacyId, actorOf(req));
    res.status(200).json(new ApiResponse(200, data, 'Pharmacy prescriptions retrieved'));
});

export const getPharmacyPrescriptionsForCurrentUser = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.getPharmacyPrescriptionsForCurrentUser(actorOf(req));
    res.status(200).json(new ApiResponse(200, data, 'Primary pharmacy prescriptions retrieved'));
});

export const reviewPrescription = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.reviewPrescription(req.params.id, req.body.status, req.body.rejectionReason, actorOf(req));
    res.status(200).json(new ApiResponse(200, data, 'Prescription reviewed'));
});
