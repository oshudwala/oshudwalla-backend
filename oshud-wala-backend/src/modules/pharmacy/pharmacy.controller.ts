import { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import * as pharmacyService from './pharmacy.service';
import { AuthRequest } from '../../middlewares/auth.middleware';

export const createNewPharmacy = asyncHandler(async (req: AuthRequest, res: Response) => {
    const adminId = req.user?.userId as string;
    const pharmacy = await pharmacyService.addPharmacy(adminId, req.body);
    res.status(201).json(new ApiResponse(201, pharmacy, "Pharmacy created successfully"));
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