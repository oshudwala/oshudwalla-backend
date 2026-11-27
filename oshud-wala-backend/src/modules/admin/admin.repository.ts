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

export const updateUserDetails = async (
    userId: string,
    data: { fullName?: string; email?: string | null; phone?: string; status?: UserStatus; roleName?: RoleName }
) => {
    const dataToUpdate: any = {};
    if (data.fullName !== undefined) dataToUpdate.fullName = String(data.fullName).trim();
    if (data.email !== undefined) dataToUpdate.email = data.email ? String(data.email).trim().toLowerCase() : null;
    if (data.phone !== undefined) dataToUpdate.phone = String(data.phone).replace(/[^0-9]/g, '');
    if (data.status !== undefined) dataToUpdate.status = data.status;

    if (data.roleName) {
        const role = await prisma.role.findUnique({ where: { name: data.roleName } });
        if (role) dataToUpdate.roleId = role.id;
    }

    return await prisma.user.update({
        where: { id: userId },
        data: dataToUpdate,
        select: { id: true, fullName: true, phone: true, email: true, status: true, role: { select: { name: true } } }
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

export const deleteUserById = async (userId: string) => {
    return await prisma.$transaction(async (tx) => {
        const uWallets = await tx.wallet.findMany({ where: { userId } });
        for (const uw of uWallets) {
            await tx.ledgerEntry.deleteMany({ where: { walletId: uw.id } });
            await tx.withdrawalRequest.deleteMany({ where: { walletId: uw.id } });
            await tx.wallet.delete({ where: { id: uw.id } });
        }

        await tx.session.deleteMany({ where: { userId } });
        await tx.passwordResetToken.deleteMany({ where: { userId } });
        await tx.patientProfile.deleteMany({ where: { userId } });
        await tx.address.deleteMany({ where: { userId } });
        await tx.notification.deleteMany({ where: { userId } });
        await tx.notificationSetting.deleteMany({ where: { userId } });
        await tx.notificationPreference.deleteMany({ where: { userId } });
        await tx.deviceToken.deleteMany({ where: { userId } });
        await tx.receptionistDoctor.deleteMany({ where: { receptionistUserId: userId } });
        await tx.pharmacyStaff.deleteMany({ where: { userId } });
        await tx.doctor.deleteMany({ where: { userId } });
        await tx.auditLog.updateMany({ where: { actorId: userId }, data: { actorId: null } });

        return await tx.user.delete({ where: { id: userId } });
    });
};
