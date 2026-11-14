import { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import * as addressService from './address.service';
import { AuthRequest } from '../../middlewares/auth.middleware';

export const addNewAddress = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.userId as string;
    const address = await addressService.addAddress(userId, req.body);
    res.status(201).json(new ApiResponse(201, address, "Address added successfully"));
});

export const getMyAddresses = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.userId as string;
    const addresses = await addressService.fetchAddresses(userId);
    res.status(200).json(new ApiResponse(200, addresses, "Addresses retrieved"));
});

export const editAddress = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.userId as string;
    const { id } = req.params;
    await addressService.modifyAddress(id, userId, req.body);
    res.status(200).json(new ApiResponse(200, null, "Address updated successfully"));
});

export const deleteAddress = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.userId as string;
    const { id } = req.params;
    await addressService.removeAddress(id, userId);
    res.status(200).json(new ApiResponse(200, null, "Address deleted successfully"));
});