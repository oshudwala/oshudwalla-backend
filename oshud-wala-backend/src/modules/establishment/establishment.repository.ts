import { PrismaClient, ServiceType } from '@prisma/client';
const prisma = new PrismaClient();

export const createEstablishment = async (adminId: string, payload: any, services: ServiceType[], makePrimary: boolean) => {
    return await prisma.$transaction(async (tx) => {
        
        // Jodi notun take primary korte hoy, purono primary take false koro
        if (makePrimary) {
            await tx.establishment.updateMany({ where: { isPrimaryPharmacy: true }, data: { isPrimaryPharmacy: false } });
        }

        // 1. Create Establishment 
        const establishment = await tx.establishment.create({
            data: {
                ...payload,
                status: 'ACTIVE', // Super Admin banacche tai direct Active
                isPrimaryPharmacy: makePrimary,
                registeredById: adminId,
                approvedById: adminId,
                approvedAt: new Date()
            }
        });

        // 2. Create Services (CLINIC, PHARMACY)
        for (const type of services) {
            await tx.establishmentService.create({
                data: {
                    establishmentId: establishment.id,
                    serviceType: type,
                    status: 'ACTIVE',
                    approvedById: adminId,
                    approvedAt: new Date()
                }
            });
        }

        return await tx.establishment.findUnique({
            where: { id: establishment.id },
            include: { services: true }
        });
    });
};

export const setAsPrimaryPharmacy = async (establishmentId: string) => {
    return await prisma.$transaction(async (tx) => {
        await tx.establishment.updateMany({ where: { isPrimaryPharmacy: true }, data: { isPrimaryPharmacy: false } });
        return await tx.establishment.update({ where: { id: establishmentId }, data: { isPrimaryPharmacy: true } });
    });
};

export const getAllEstablishments = async () => {
    return await prisma.establishment.findMany({
        where: { status: 'ACTIVE' },
        include: { services: true }
    });
};