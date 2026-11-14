import { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import * as adminService from './admin.service';
import { AuthRequest } from '../../middlewares/auth.middleware';

export const getUsersList = asyncHandler(async (req: AuthRequest, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const users = await adminService.fetchAllUsers(page, limit);
    res.status(200).json(new ApiResponse(200, users, "Users retrieved successfully"));
});

export const updateUserAccess = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { roleName, status } = req.body;
    const result = await adminService.modifyUserAccess(id, roleName, status);
    res.status(200).json(new ApiResponse(200, result, "User access updated successfully"));
});

export const getSettings = asyncHandler(async (req: AuthRequest, res: Response) => {
    const settings = await adminService.fetchAllSettings();
    res.status(200).json(new ApiResponse(200, settings, "Platform settings retrieved"));
});

export const setSetting = asyncHandler(async (req: AuthRequest, res: Response) => {
    const adminId = req.user?.userId as string;
    const { key, value } = req.body;
    const setting = await adminService.updateSetting(key, value, adminId);
    res.status(200).json(new ApiResponse(200, setting, "Platform setting updated"));
});