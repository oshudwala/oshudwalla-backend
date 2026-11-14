import { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import * as establishmentService from './establishment.service';
import { AuthRequest } from '../../middlewares/auth.middleware';

export const adminCreateEstablishment = asyncHandler(async (req: AuthRequest, res: Response) => {
    const adminId = req.user?.userId as string; // Super Admin er ID
    const establishment = await establishmentService.createEstablishmentByAdmin(adminId, req.body);
    res.status(201).json(new ApiResponse(201, establishment, "Establishment created successfully by Admin"));
});

export const adminMakePrimary = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const establishment = await establishmentService.makePrimary(id);
    res.status(200).json(new ApiResponse(200, establishment, "Set as Primary Pharmacy successfully"));
});

export const getPublicEstablishments = asyncHandler(async (req: AuthRequest, res: Response) => {
    const establishments = await establishmentService.fetchAllActiveEstablishments();
    res.status(200).json(new ApiResponse(200, establishments, "Active establishments retrieved"));
});