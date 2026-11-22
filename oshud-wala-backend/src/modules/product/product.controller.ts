import { Response } from 'express';
import { RoleName } from '@prisma/client';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { AuthRequest } from '../../middlewares/auth.middleware';
import * as service from './product.service';
import { listProductsSchema } from './product.validation';

const actorOf = (req: AuthRequest) => ({ id: req.user!.userId, role: req.user!.role as RoleName });

export const listProducts = asyncHandler(async (req: AuthRequest, res: Response) => {
    const parsed = listProductsSchema.shape.query.parse(req.query);
    const data = await service.listProducts(parsed);
    res.status(200).json(new ApiResponse(200, data, 'Products retrieved'));
});

export const getProduct = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.getProduct(req.params.id);
    res.status(200).json(new ApiResponse(200, data, 'Product retrieved'));
});

export const createProduct = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.createProduct(req.body, actorOf(req));
    res.status(201).json(new ApiResponse(201, data, 'Product created'));
});

export const updateProduct = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.updateProduct(req.params.id, req.body, actorOf(req));
    res.status(200).json(new ApiResponse(200, data, 'Product updated'));
});
