import bcrypt from 'bcrypt';
import { ApiError } from '../../utils/apiError';
import { generateAccessToken, generateRefreshTokenString, hashToken } from '../../utils/jwt.util';
import * as authRepo from './auth.repository';
import { RoleName } from '@prisma/client';

export const registerUser = async (data: any, userAgent?: string, ipAddress?: string) => {
    const { fullName, phone, email, password } = data;

    // Database check via Repository
    const existingUser = await authRepo.findUserByPhoneOrEmail(phone, email);
    if (existingUser) {
        throw new ApiError(400, 'User with this phone or email already exists');
    }

    const patientRole = await authRepo.getRoleByName(RoleName.PATIENT);
    if (!patientRole) {
        throw new ApiError(500, 'Role setup incomplete in database');
    }

    // Business Logic
    const passwordHash = await bcrypt.hash(password, 10);

    // Database insert via Repository
    const user = await authRepo.createNewUser({
        fullName,
        phone,
        email,
        passwordHash,
        roleId: patientRole.id
    });

    const session = await authRepo.createNewSession({ userId: user.id, userAgent, ipAddress });

    const accessToken = generateAccessToken(user.id, user.role.name);
    const refreshTokenString = generateRefreshTokenString();

    await authRepo.saveRefreshToken({
        sessionId: session.id,
        tokenHash: hashToken(refreshTokenString),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    return { user, accessToken, refreshToken: refreshTokenString, sessionId: session.id };
};

export const loginUser = async (identifier: string, password: string, userAgent?: string, ipAddress?: string) => {
    const user = await authRepo.findUserByPhoneOrEmail(identifier, identifier);

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        throw new ApiError(401, 'Invalid credentials');
    }

    if (user.status !== 'ACTIVE') {
        throw new ApiError(403, 'Account is currently suspended or deactivated');
    }

    const session = await authRepo.createNewSession({ userId: user.id, userAgent, ipAddress });

    const accessToken = generateAccessToken(user.id, user.role.name);
    const refreshTokenString = generateRefreshTokenString();

    await authRepo.saveRefreshToken({
        sessionId: session.id,
        tokenHash: hashToken(refreshTokenString),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    return {
        user: { id: user.id, fullName: user.fullName, role: user.role.name },
        accessToken,
        refreshToken: refreshTokenString,
        sessionId: session.id
    };
};

export const refreshSession = async (refreshToken: string, sessionId: string) => {
    const session = await authRepo.getSessionWithUser(sessionId);

    if (!session || session.revokedAt) {
        throw new ApiError(401, 'Invalid or revoked session');
    }

    const tokenHash = hashToken(refreshToken);
    const activeToken = await authRepo.getActiveRefreshToken(sessionId, tokenHash);

    if (!activeToken || activeToken.expiresAt < new Date()) {
        await authRepo.revokeSession(sessionId, 'Token reuse or expiration detected');
        throw new ApiError(401, 'Invalid or expired refresh token. Session revoked for security.');
    }

    await authRepo.markRefreshTokenUsed(activeToken.id);

    const newAccessToken = generateAccessToken(session.user.id, session.user.role.name);
    const newRefreshTokenString = generateRefreshTokenString();

    await authRepo.saveRefreshToken({
        sessionId,
        tokenHash: hashToken(newRefreshTokenString),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    return { accessToken: newAccessToken, refreshToken: newRefreshTokenString, sessionId };
};

export const logoutSession = async (sessionId: string) => {
    await authRepo.revokeSession(sessionId, 'User requested logout');
};