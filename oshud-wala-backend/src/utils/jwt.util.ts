import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'oshudwala_super_secret_key_123';

export const generateAccessToken = (userId: string, role: string): string => {
    return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: '15m' });
};

export const verifyAccessToken = (token: string): any => {
    return jwt.verify(token, JWT_SECRET);
};

export const generateRefreshTokenString = (): string => {
    return crypto.randomBytes(40).toString('hex');
};

export const hashToken = (token: string): string => {
    return crypto.createHash('sha256').update(token).digest('hex');
};