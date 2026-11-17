import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export const createSpecialization = async (data: any) => {
    return await prisma.specialization.create({
        data
    });
};

export const getAllSpecializations = async () => {
    return await prisma.specialization.findMany({
        orderBy: { name: 'asc' } // Alphabetical order-e sajano thakbe (A to Z)
    });
};