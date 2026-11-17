import { PrismaClient } from '@prisma/client';
import { ApiError } from '../../utils/apiError';
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
        const target = await tx.pharmacy.findUnique({ where: { id: pharmacyId } });
        if (!target) throw new ApiError(404, 'Pharmacy not found');
        if (target.status !== 'ACTIVE') throw new ApiError(400, 'Only an ACTIVE pharmacy can be set as Primary');

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