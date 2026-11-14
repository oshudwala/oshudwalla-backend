import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// User er sob basic details ar patient profile fetch korbe
export const getUserProfile = async (userId: string) => {
    return await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            fullName: true,
            phone: true,
            email: true,
            role: { select: { name: true } },
            patientProfile: true
        }
    });
};

// User ar PatientProfile ek sathe update korbe
export const updateUserAndPatientProfile = async (userId: string, userData: any, patientData: any) => {
    return await prisma.$transaction(async (tx) => {
        // 1. Update basic user data (fullName, email)
        if (Object.keys(userData).length > 0) {
            await tx.user.update({
                where: { id: userId },
                data: userData
            });
        }

        // 2. Upsert Patient Profile (na thakle toiri hobe, thakle update)
        if (Object.keys(patientData).length > 0) {
            await tx.patientProfile.upsert({
                where: { userId },
                update: patientData,
                create: { userId, ...patientData }
            });
        }

        // Return updated profile
        return await tx.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                fullName: true,
                phone: true,
                email: true,
                patientProfile: true
            }
        });
    });
};