import bcrypt from 'bcrypt';
import { ApiError } from '../../utils/apiError';
import { generateAccessToken, generateRefreshTokenString, hashToken } from '../../utils/jwt.util';
import * as authRepo from './auth.repository';
import { RoleName } from '@prisma/client';
import { redisConnection } from '../../config/redis';
import { generateNumericOtp, hashOtp, sendApitxtOtp } from '../../utils/apitxt.util';

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
// ---------------- Patient Registration OTP (APITXT + Redis) ----------------

const OTP_TTL_SECONDS = 300; // 5 minutes
const OTP_MAX_ATTEMPTS = 5;
const OTP_RATE_LIMIT_MAX = 3; // max 3 OTPs per minute per phone (matches APITXT)

export const sendRegistrationOtp = async (phone: string) => {
    const cleanPhone = String(phone).trim();

    const existing = await authRepo.findUserByPhoneOrEmail(cleanPhone);
    if (existing) {
        throw new ApiError(409, 'A user with this phone already exists');
    }

    const rateKey = `otp:rate:reg:${cleanPhone}`;
    const count = await redisConnection.incr(rateKey);
    if (count === 1) {
        await redisConnection.expire(rateKey, 60);
    }
    if (count > OTP_RATE_LIMIT_MAX) {
        throw new ApiError(429, 'Too many OTP requests. Please try again after 1 minute.');
    }

    const otp = generateNumericOtp(6);
    const otpHash = hashOtp(cleanPhone, otp);

    const otpKey = `otp:reg:${cleanPhone}`;
    await redisConnection.set(
        otpKey,
        JSON.stringify({ otpHash, attempts: 0 }),
        'EX',
        OTP_TTL_SECONDS
    );

    try {
        await sendApitxtOtp(cleanPhone, otp);
    } catch (error: any) {
        await redisConnection.del(otpKey);
        throw new ApiError(502, error?.message || 'Failed to send OTP');
    }

    return {
        phone: cleanPhone,
        expiresInSeconds: OTP_TTL_SECONDS,
        ...(process.env.NODE_ENV === 'test' ? { testOtp: otp } : {}),
    };
};

export const registerPatientWithOtp = async (data: any, userAgent?: string, ipAddress?: string) => {
    const cleanPhone = String(data.phone).trim();
    const otpKey = `otp:reg:${cleanPhone}`;
    const raw = await redisConnection.get(otpKey);

    if (!raw) {
        throw new ApiError(400, 'OTP expired or not requested. Please request a new OTP.');
    }

    const record = JSON.parse(raw) as { otpHash: string; attempts: number };
    if (record.attempts >= OTP_MAX_ATTEMPTS) {
        await redisConnection.del(otpKey);
        throw new ApiError(400, 'Too many invalid OTP attempts. Please request a new OTP.');
    }

    const incomingHash = hashOtp(cleanPhone, String(data.otp).trim());
    if (incomingHash !== record.otpHash) {
        record.attempts += 1;
        const ttl = await redisConnection.ttl(otpKey);
        if (ttl > 0) {
            await redisConnection.set(otpKey, JSON.stringify(record), 'EX', ttl);
        }
        throw new ApiError(400, 'Invalid OTP');
    }

    // OTP valid -> consume it immediately so it cannot be reused
    await redisConnection.del(otpKey);

    const existingUser = await authRepo.findUserByPhoneOrEmail(cleanPhone, data.email || undefined);
    if (existingUser) {
        throw new ApiError(409, 'User with this phone or email already exists');
    }

    const patientRole = await authRepo.getRoleByName(RoleName.PATIENT);
    if (!patientRole) {
        throw new ApiError(500, 'Role setup incomplete in database');
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    const user = await authRepo.createNewUser({
        fullName: String(data.fullName).trim(),
        phone: cleanPhone,
        email: data.email ? String(data.email).trim().toLowerCase() : null,
        passwordHash,
        roleId: patientRole.id,
        phoneVerifiedAt: new Date(),
    });

    const session = await authRepo.createNewSession({ userId: user.id, userAgent, ipAddress });
    const accessToken = generateAccessToken(user.id, user.role.name);
    const refreshTokenString = generateRefreshTokenString();

    await authRepo.saveRefreshToken({
        sessionId: session.id,
        tokenHash: hashToken(refreshTokenString),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    return { user, accessToken, refreshToken: refreshTokenString, sessionId: session.id };
};

// ---------------- Patient Login OTP (PATIENT role ONLY; others use email+password) ----------------

export const sendPatientLoginOtp = async (phone: string) => {
    const cleanPhone = String(phone).trim();

    const rateKey = `otp:rate:login:${cleanPhone}`;
    const count = await redisConnection.incr(rateKey);
    if (count === 1) {
        await redisConnection.expire(rateKey, 60);
    }
    if (count > OTP_RATE_LIMIT_MAX) {
        throw new ApiError(429, 'Too many OTP requests. Please try again after 1 minute.');
    }

    const user = await authRepo.findUserByPhoneOrEmail(cleanPhone);
    if (!user) {
        throw new ApiError(404, 'No account found with this phone number');
    }
    if (user.role.name !== RoleName.PATIENT) {
        throw new ApiError(403, 'OTP login is only allowed for Patients. Please login with email and password.');
    }
    if (user.status !== 'ACTIVE') {
        throw new ApiError(403, 'Account is currently suspended or deactivated');
    }

    const otp = generateNumericOtp(6);
    const otpHash = hashOtp(cleanPhone, otp);
    const otpKey = `otp:login:${cleanPhone}`;

    await redisConnection.set(
        otpKey,
        JSON.stringify({ otpHash, attempts: 0 }),
        'EX',
        OTP_TTL_SECONDS
    );

    try {
        await sendApitxtOtp(cleanPhone, otp);
    } catch (error: any) {
        await redisConnection.del(otpKey);
        throw new ApiError(502, error?.message || 'Failed to send OTP');
    }

    return {
        phone: cleanPhone,
        expiresInSeconds: OTP_TTL_SECONDS,
        ...(process.env.NODE_ENV === 'test' ? { testOtp: otp } : {}),
    };
};

export const verifyPatientLoginOtp = async (phone: string, otp: string, userAgent?: string, ipAddress?: string) => {
    const cleanPhone = String(phone).trim();
    const otpKey = `otp:login:${cleanPhone}`;
    const raw = await redisConnection.get(otpKey);

    if (!raw) {
        throw new ApiError(400, 'OTP expired or not requested. Please request a new OTP.');
    }

    const record = JSON.parse(raw) as { otpHash: string; attempts: number };
    if (record.attempts >= OTP_MAX_ATTEMPTS) {
        await redisConnection.del(otpKey);
        throw new ApiError(400, 'Too many invalid OTP attempts. Please request a new OTP.');
    }

    const incomingHash = hashOtp(cleanPhone, String(otp).trim());
    if (incomingHash !== record.otpHash) {
        record.attempts += 1;
        const ttl = await redisConnection.ttl(otpKey);
        if (ttl > 0) {
            await redisConnection.set(otpKey, JSON.stringify(record), 'EX', ttl);
        }
        throw new ApiError(400, 'Invalid OTP');
    }

    await redisConnection.del(otpKey);

    const user = await authRepo.findUserByPhoneOrEmail(cleanPhone);
    if (!user) {
        throw new ApiError(404, 'Account not found');
    }
    if (user.role.name !== RoleName.PATIENT) {
        throw new ApiError(403, 'OTP login is only allowed for Patients. Please login with email and password.');
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
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    return {
        user: { id: user.id, fullName: user.fullName, role: user.role.name },
        accessToken,
        refreshToken: refreshTokenString,
        sessionId: session.id,
    };
};
