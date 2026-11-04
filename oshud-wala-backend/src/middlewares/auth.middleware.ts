import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.util';
import { ApiError } from '../utils/apiError';

export interface AuthRequest extends Request {
    user?: { userId: string; role: string };
    sessionId?: string;
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return next(new ApiError(401, 'Unauthorized'));
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = verifyAccessToken(token);
        req.user = decoded;
        next();
    } catch (error) {
        return next(new ApiError(401, 'Invalid or expired token'));
    }
};