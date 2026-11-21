import { Response } from 'express';
import { RoleName } from '@prisma/client';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { AuthRequest } from '../../middlewares/auth.middleware';
import * as service from './schedule.service';

const actorOf = (req: AuthRequest) => ({ id: req.user!.userId, role: req.user!.role as RoleName });

export const createSchedule = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.createSchedule(req.body, actorOf(req));
    res.status(201).json(new ApiResponse(201, data, 'Doctor schedule created'));
});

export const getSchedules = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.fetchSchedules(req.params.pharmacyDoctorId);
    res.status(200).json(new ApiResponse(200, data, 'Doctor schedules retrieved'));
});

export const upsertException = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.saveException(req.body, actorOf(req));
    res.status(200).json(new ApiResponse(200, data, 'Schedule exception saved'));
});

export const generateSlots = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.generateSlots(req.body, actorOf(req));
    res.status(201).json(new ApiResponse(201, data, 'Appointment slots generated'));
});

export const getSlots = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.fetchSlots(req.params.pharmacyDoctorId, req.query);
    res.status(200).json(new ApiResponse(200, data, 'Appointment slots retrieved'));
});

export const updateSlotStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.setSlotStatus(req.params.slotId, req.body.status, actorOf(req));
    res.status(200).json(new ApiResponse(200, data, 'Appointment slot status updated'));
});
