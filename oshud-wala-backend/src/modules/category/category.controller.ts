import { Response } from 'express';
import { RoleName } from '@prisma/client';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { AuthRequest } from '../../middlewares/auth.middleware';
import * as service from './category.service';

const actorOf = (req: AuthRequest) => ({ id: req.user!.userId, role: req.user!.role as RoleName });

export const listCategories = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.listCategories(req.query.parentId as string | undefined);
    res.status(200).json(new ApiResponse(200, data, 'Categories retrieved'));
});

export const createCategory = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.createCategory(req.body, actorOf(req));
    res.status(201).json(new ApiResponse(201, data, 'Category created'));
});

export const updateCategory = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.updateCategory(req.params.id, req.body, actorOf(req));
    res.status(200).json(new ApiResponse(200, data, 'Category updated'));
});
