import { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import * as userService from './user.service';
import { AuthRequest } from '../../middlewares/auth.middleware';

export const getMyProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.userId;
    const profile = await userService.fetchProfile(userId as string);
    res.status(200).json(new ApiResponse(200, profile, "Profile retrieved successfully"));
});

export const updateMyProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.userId;
    const updatedProfile = await userService.modifyProfile(userId as string, req.body);
    res.status(200).json(new ApiResponse(200, updatedProfile, "Profile updated successfully"));
});