import { Response } from 'express';
import { RoleName } from '@prisma/client';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import * as pharmacyService from './pharmacy.service';
import { AuthRequest } from '../../middlewares/auth.middleware';

export const createNewPharmacy = asyncHandler(async (req: AuthRequest, res: Response) => {
    const actor = { id: req.user!.userId, role: req.user!.role as RoleName };
    const pharmacy = await pharmacyService.addPharmacy(actor, req.body);
    res.status(201).json(new ApiResponse(201, pharmacy, "Pharmacy and owner account created successfully"));
});

export const makePharmacyPrimary = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const pharmacy = await pharmacyService.makePrimary(id);
    res.status(200).json(new ApiResponse(200, pharmacy, "Primary Pharmacy updated successfully"));
});

export const getPharmacies = asyncHandler(async (req: AuthRequest, res: Response) => {
    const pharmacies = await pharmacyService.fetchPharmacies();
    res.status(200).json(new ApiResponse(200, pharmacies, "Pharmacies retrieved successfully"));
});

export const getMyPharmacies = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await pharmacyService.fetchMyPharmacies(req.user!.userId);
    res.status(200).json(new ApiResponse(200, data, "Your pharmacies retrieved"));
});

export const updatePharmacyProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
    const actor = { id: req.user!.userId, role: req.user!.role as RoleName };
    const data = await pharmacyService.updatePharmacy(req.params.id, req.body, actor);
    res.status(200).json(new ApiResponse(200, data, "Pharmacy updated successfully"));
});

export const adminUpdatePharmacy = asyncHandler(async (req: AuthRequest, res: Response) => {
    const actor = { id: req.user!.userId, role: req.user!.role as RoleName };
    const data = await pharmacyService.adminUpdatePharmacy(req.params.id, req.body, actor);
    res.status(200).json(new ApiResponse(200, data, "Pharmacy admin settings updated successfully"));
});
