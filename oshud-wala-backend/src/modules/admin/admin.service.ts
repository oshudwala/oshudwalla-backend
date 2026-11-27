import { ApiError } from '../../utils/apiError';
import * as adminRepo from './admin.repository';
import { RoleName, UserStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';

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

export const updateUserProfile = async (
    userId: string,
    body: { fullName?: string; email?: string | null; phone?: string; status?: UserStatus; roleName?: RoleName }
) => {
    const existing = await prisma.user.findUnique({ where: { id: userId } });
    if (!existing) throw new ApiError(404, "User not found");

    const phone = body.phone ? String(body.phone).replace(/[^0-9]/g, '') : undefined;
    const email = body.email !== undefined ? (body.email ? String(body.email).trim().toLowerCase() : null) : undefined;

    if (phone && phone !== existing.phone) {
        const conflict = await prisma.user.findFirst({ where: { phone, NOT: { id: userId } } });
        if (conflict) throw new ApiError(409, "Phone number is already registered to another account");
    }

    if (email && email !== existing.email) {
        const conflict = await prisma.user.findFirst({ where: { email, NOT: { id: userId } } });
        if (conflict) throw new ApiError(409, "Email address is already registered to another account");
    }

    return await adminRepo.updateUserDetails(userId, { ...body, phone, email });
};

export const updateSetting = async (key: string, value: any, adminId: string) => {
    return await adminRepo.upsertPlatformSetting(key, value, adminId);
};

export const fetchAllSettings = async () => {
    return await adminRepo.getPlatformSettings();
};

export const deleteUser = async (userId: string) => {
    try {
        return await adminRepo.deleteUserById(userId);
    } catch (error: any) {
        console.error("Failed to delete user:", error);
        throw new ApiError(500, "Failed to delete user profile from database.");
    }
};
