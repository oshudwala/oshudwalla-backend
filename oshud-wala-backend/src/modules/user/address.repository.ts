import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export const countActiveAddresses = async (userId: string) => {
    return await prisma.address.count({ where: { userId, deletedAt: null } });
};

export const clearDefaultAddress = async (userId: string) => {
    await prisma.address.updateMany({
        where: { userId, isDefault: true, deletedAt: null },
        data: { isDefault: false }
    });
};

export const createAddress = async (userId: string, data: any) => {
    return await prisma.address.create({ data: { userId, ...data } });
};

export const getAddresses = async (userId: string) => {
    return await prisma.address.findMany({
        where: { userId, deletedAt: null },
        orderBy: { isDefault: 'desc' } // Default ta sobar upore asbe
    });
};

export const updateAddress = async (id: string, userId: string, data: any) => {
    return await prisma.address.updateMany({
        where: { id, userId, deletedAt: null },
        data
    });
};

export const softDeleteAddress = async (id: string, userId: string) => {
    return await prisma.address.updateMany({
        where: { id, userId, deletedAt: null },
        data: { deletedAt: new Date() }
    });
};