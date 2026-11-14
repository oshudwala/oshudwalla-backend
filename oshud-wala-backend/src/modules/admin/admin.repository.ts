import { PrismaClient, RoleName, UserStatus } from '@prisma/client';
const prisma = new PrismaClient();

export const getAllUsers = async (skip: number, take: number) => {
    return await prisma.user.findMany({
        skip,
        take,
        select: { id: true, fullName: true, phone: true, email: true, status: true, role: { select: { name: true } } },
        orderBy: { createdAt: 'desc' }
    });
};

export const updateUserRoleAndStatus = async (userId: string, roleName: RoleName, status?: UserStatus) => {
    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) throw new Error("Role not found in DB");

    const dataToUpdate: any = { roleId: role.id };
    if (status) dataToUpdate.status = status;

    return await prisma.user.update({
        where: { id: userId },
        data: dataToUpdate,
        select: { id: true, fullName: true, status: true, role: { select: { name: true } } }
    });
};

export const upsertPlatformSetting = async (key: string, value: any, adminId: string) => {
    return await prisma.platformSetting.upsert({
        where: { key },
        update: { value, updatedBy: adminId },
        create: { key, value, updatedBy: adminId }
    });
};

export const getPlatformSettings = async () => {
    return await prisma.platformSetting.findMany();
};