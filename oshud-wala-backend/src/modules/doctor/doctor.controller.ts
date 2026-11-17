import { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import * as doctorService from './doctor.service';
import { AuthRequest } from '../../middlewares/auth.middleware';

export const onboardDoctor = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { pharmacyId, ...doctorData } = req.body;
    const doctor = await doctorService.addDoctor(pharmacyId, doctorData);
    res.status(201).json(new ApiResponse(201, doctor, "Doctor added to pharmacy successfully"));
});

export const getDoctorsList = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { pharmacyId } = req.params;
    const doctors = await doctorService.fetchPharmacyDoctors(pharmacyId);
    res.status(200).json(new ApiResponse(200, doctors, "Pharmacy doctors retrieved"));
});