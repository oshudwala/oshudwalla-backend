import { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import * as specService from './specialization.service';
import { AuthRequest } from '../../middlewares/auth.middleware';

export const createSpecialization = asyncHandler(async (req: AuthRequest, res: Response) => {
    const spec = await specService.addSpecialization(req.body);
    res.status(201).json(new ApiResponse(201, spec, "Specialization added successfully"));
});

export const getSpecializations = asyncHandler(async (req: AuthRequest, res: Response) => {
    const specs = await specService.fetchSpecializations();
    res.status(200).json(new ApiResponse(200, specs, "Specializations retrieved successfully"));
});