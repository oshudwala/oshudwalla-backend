import { ApiError } from '../../utils/apiError';
import * as adminRepo from './admin.repository';
import { RoleName, UserStatus } from '@prisma/client';

export const fetchAllUsers = async (page: number = 1, limit: number = 10) => {
    const skip = (page - 1) * limit;
    return await adminRepo.getAllUsers(skip, limit);
};

export const modifyUserAccess = async (userId: string, roleName: RoleName, status?: UserStatus) => {
    try {
        return await adminRepo.updateUserRoleAndStatus(userId, roleName, status);
    } catch (error) {
        throw new ApiError(400, "Failed to update user access. Check if role exists.");
    }
};

export const updateSetting = async (key: string, value: any, adminId: string) => {
    return await adminRepo.upsertPlatformSetting(key, value, adminId);
};

export const fetchAllSettings = async () => {
    return await adminRepo.getPlatformSettings();
};