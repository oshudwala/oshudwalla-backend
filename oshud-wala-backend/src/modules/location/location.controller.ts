import { Response } from 'express';
import { RoleName } from '@prisma/client';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { AuthRequest } from '../../middlewares/auth.middleware';
import * as service from './location.service';
import { listLocationSchema } from './location.validation';

// validate() only checks; it does not apply defaults, so parse the query here to get page/limit defaults.
const parseQuery = (req: AuthRequest) => listLocationSchema.shape.query.parse(req.query);

const actorOf = (req: AuthRequest) => ({ id: req.user!.userId, role: req.user!.role as RoleName });

export const create = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.createLocation(req.body, actorOf(req));
    res.status(201).json(new ApiResponse(201, data, 'Location created'));
});

export const update = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.updateLocation(req.params.id, req.body, actorOf(req));
    res.status(200).json(new ApiResponse(200, data, 'Location updated'));
});

export const setStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.setStatus(req.params.id, req.body.isActive, actorOf(req));
    res.status(200).json(new ApiResponse(200, data, 'Location status updated'));
});

// Public: active locations only
export const listPublic = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.listLocations(parseQuery(req), false);
    res.status(200).json(new ApiResponse(200, data, 'Locations retrieved'));
});

export const getPublic = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.getLocation(req.params.id, true);
    res.status(200).json(new ApiResponse(200, data, 'Location retrieved'));
});

// Super Admin: all locations, optional isActive filter
export const listAdmin = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.listLocations(parseQuery(req), true);
    res.status(200).json(new ApiResponse(200, data, 'Locations retrieved'));
});
