import { Response } from 'express';
import { RoleName } from '@prisma/client';
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

export const listGlobalDoctors = asyncHandler(async (req: AuthRequest, res: Response) => {
    const q = req.query.q as string | undefined;
    const specializationId = req.query.specializationId as string | undefined;
    const doctors = await doctorService.fetchGlobalDoctors(q, specializationId);
    res.status(200).json(new ApiResponse(200, doctors, "Doctors retrieved successfully"));
});

export const getDoctorById = asyncHandler(async (req: AuthRequest, res: Response) => {
    const doctor = await doctorService.fetchDoctorById(req.params.id);
    res.status(200).json(new ApiResponse(200, doctor, "Doctor retrieved successfully"));
});

export const createGlobalDoctor = asyncHandler(async (req: AuthRequest, res: Response) => {
    const actor = { id: req.user!.userId, role: req.user!.role as RoleName };
    const doctor = await doctorService.createGlobalDoctor(req.body, actor);
    res.status(201).json(new ApiResponse(201, doctor, "Global doctor profile created successfully"));
});

export const updateGlobalDoctor = asyncHandler(async (req: AuthRequest, res: Response) => {
    const actor = { id: req.user!.userId, role: req.user!.role as RoleName };
    const doctor = await doctorService.updateGlobalDoctor(req.params.id, req.body, actor);
    res.status(200).json(new ApiResponse(200, doctor, "Doctor profile updated successfully"));
});

export const assignDoctor = asyncHandler(async (req: AuthRequest, res: Response) => {
    const actor = { id: req.user!.userId, role: req.user!.role as RoleName };
    const assignment = await doctorService.assignDoctorToPharmacy(req.body, actor);
    res.status(200).json(new ApiResponse(200, assignment, "Doctor assigned to pharmacy successfully"));
});

export const updateAssignmentStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
    const actor = { id: req.user!.userId, role: req.user!.role as RoleName };
    const assignment = await doctorService.setAssignmentStatus(req.params.assignmentId, req.body.isActive, actor);
    res.status(200).json(new ApiResponse(200, assignment, "Doctor assignment status updated"));
});
