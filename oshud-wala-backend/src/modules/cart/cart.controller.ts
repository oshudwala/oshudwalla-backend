import { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { AuthRequest } from '../../middlewares/auth.middleware';
import * as service from './cart.service';

export const getCart = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.getMyCart(req.user!.userId);
    res.status(200).json(new ApiResponse(200, data, 'Cart retrieved'));
});

export const addCartItem = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.addItem(req.user!.userId, req.body.productId, req.body.quantity ?? 1);
    res.status(200).json(new ApiResponse(200, data, 'Item added to cart'));
});

export const updateCartItem = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.updateItemQuantity(req.user!.userId, req.params.productId, req.body.quantity);
    res.status(200).json(new ApiResponse(200, data, 'Cart updated'));
});

export const removeCartItem = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.removeItem(req.user!.userId, req.params.productId);
    res.status(200).json(new ApiResponse(200, data, 'Item removed from cart'));
});

export const clearCart = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await service.clearMyCart(req.user!.userId);
    res.status(200).json(new ApiResponse(200, data, 'Cart cleared'));
});
