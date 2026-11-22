import { Response } from 'express';
import { RoleName } from '@prisma/client';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { AuthRequest } from '../../middlewares/auth.middleware';
import * as service from './support.service';

const actorOf = (req: AuthRequest) => ({ id: req.user!.userId, role: req.user!.role as RoleName });

export const createTicket = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.createTicket(req.body, actorOf(req));
    res.status(201).json(new ApiResponse(201, data, 'Support ticket created'));
});

export const listTickets = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.listTickets(actorOf(req));
    res.status(200).json(new ApiResponse(200, data, 'Support tickets retrieved'));
});

export const getTicket = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.getTicket(req.params.id, actorOf(req));
    res.status(200).json(new ApiResponse(200, data, 'Support ticket retrieved'));
});

export const addMessage = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.addMessage(req.params.id, req.body.body, actorOf(req));
    res.status(201).json(new ApiResponse(201, data, 'Reply added'));
});

export const updateTicketStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.updateTicketStatus(req.params.id, req.body);
    res.status(200).json(new ApiResponse(200, data, 'Support ticket updated'));
});
