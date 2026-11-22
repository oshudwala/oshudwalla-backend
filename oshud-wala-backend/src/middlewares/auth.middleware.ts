import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.util';
import { ApiError } from '../utils/apiError';
import { RoleName } from '@prisma/client';
import { prisma } from '../config/prisma';

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

export const authorizeRoles = (...allowedRoles: RoleName[]) => {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                return next(new ApiError(401, 'Unauthorized access'));
            }

            // DB theke current role niye check korchi (jete real-time access update kaj kore)
            const user = await prisma.user.findUnique({
                where: { id: userId },
                include: { role: true }
            });

            if (!user || !user.role || !allowedRoles.includes(user.role.name as RoleName)) {
                return next(new ApiError(403, 'Forbidden: You do not have permission to access this resource'));
            }

            next();
        } catch (error) {
            next(error);
        }
    };
};