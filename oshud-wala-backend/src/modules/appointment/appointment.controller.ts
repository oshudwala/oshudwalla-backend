import { Response } from 'express';
import { RoleName } from '@prisma/client';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { AuthRequest } from '../../middlewares/auth.middleware';
import * as service from './appointment.service';

const actorOf = (req: AuthRequest) => ({ id: req.user!.userId, role: req.user!.role as RoleName });

export const bookAppointment = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.bookAppointment(req.body, actorOf(req));
    res.status(201).json(new ApiResponse(201, data, 'Appointment booked successfully'));
});

export const getMyAppointments = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.fetchMyAppointments(req.user!.userId);
    res.status(200).json(new ApiResponse(200, data, 'Your appointments retrieved'));
});

export const getPharmacyDoctorAppointments = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.fetchPharmacyDoctorAppointments(
        req.params.pharmacyDoctorId,
        req.query.date as string | undefined,
        actorOf(req)
    );
    res.status(200).json(new ApiResponse(200, data, 'Appointments retrieved'));
});

export const cancelAppointment = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.cancelAppointment(req.params.id, req.body.cancelReason, actorOf(req));
    res.status(200).json(new ApiResponse(200, data, 'Appointment cancelled'));
});

export const updateAppointmentStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.updateAppointmentStatus(
        req.params.id,
        req.body.status,
        req.body.doctorNotes,
        actorOf(req)
    );
    res.status(200).json(new ApiResponse(200, data, 'Appointment status updated'));
});

export const getLiveQueue = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.fetchLiveQueue(req.params.pharmacyDoctorId, req.query.date as string | undefined);
    res.status(200).json(new ApiResponse(200, data, 'Live queue retrieved'));
});

export const updateQueueStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.setQueueStatus(
        req.params.pharmacyDoctorId,
        req.body.queueDate,
        req.body.status,
        actorOf(req)
    );
    res.status(200).json(new ApiResponse(200, data, 'Queue status updated'));
});
