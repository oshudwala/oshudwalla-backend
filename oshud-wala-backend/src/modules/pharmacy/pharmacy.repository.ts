import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export const createPharmacy = async (adminId: string, data: any) => {
    return await prisma.$transaction(async (tx) => {
        // Rule: Only one pharmacy can be Primary at a time
        if (data.isPrimary) {
            await tx.pharmacy.updateMany({
                where: { isPrimary: true },
                data: { isPrimary: false }
            });
        }

        return await tx.pharmacy.create({
            data: {
                ...data,
                registeredById: adminId,
                approvedById: adminId,
                approvedAt: new Date(),
                status: 'ACTIVE'
            }
        });
    });
};

export const setPrimaryPharmacy = async (pharmacyId: string) => {
    return await prisma.$transaction(async (tx) => {
        // 1. Unset the current primary pharmacy
        await tx.pharmacy.updateMany({
            where: { isPrimary: true },
            data: { isPrimary: false }
        });

        // 2. Set the new primary pharmacy
        return await tx.pharmacy.update({
            where: { id: pharmacyId },
            data: { isPrimary: true }
        });
    });
};

export const getAllPharmacies = async () => {
    return await prisma.pharmacy.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' }
    });
};