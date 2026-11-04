import { PrismaClient, RoleName } from '@prisma/client';

const prisma = new PrismaClient();

export const findUserByPhoneOrEmail = async (phone: string, email?: string) => {
    return await prisma.user.findFirst({
        where: { OR: [{ phone }, { email: email || undefined }] },
        include: { role: true }
    });
};

export const getRoleByName = async (roleName: RoleName) => {
    return await prisma.role.findUnique({ 
        where: { name: roleName } 
    });
};

export const createNewUser = async (userData: any) => {
    return await prisma.user.create({
        data: userData,
        select: { id: true, fullName: true, phone: true, email: true, role: true }
    });
};

export const createNewSession = async (sessionData: any) => {
    return await prisma.session.create({ 
        data: sessionData 
    });
};

export const saveRefreshToken = async (tokenData: any) => {
    return await prisma.refreshToken.create({ 
        data: tokenData 
    });
};

export const getSessionWithUser = async (sessionId: string) => {
    return await prisma.session.findUnique({
        where: { id: sessionId },
        include: { user: { include: { role: true } } }
    });
};

export const getActiveRefreshToken = async (sessionId: string, tokenHash: string) => {
    return await prisma.refreshToken.findFirst({
        where: { sessionId, tokenHash, usedAt: null, revokedAt: null }
    });
};

export const revokeSession = async (sessionId: string, reason: string) => {
    return await prisma.session.update({
        where: { id: sessionId },
        data: { revokedAt: new Date(), revokedReason: reason }
    });
};

export const markRefreshTokenUsed = async (tokenId: string) => {
    return await prisma.refreshToken.update({
        where: { id: tokenId },
        data: { usedAt: new Date() }
    });
};