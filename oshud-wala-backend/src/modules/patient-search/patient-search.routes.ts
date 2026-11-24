import { Router, Response } from 'express';
import { prisma } from '../../config/prisma';
import { authenticate, authorizeRoles, AuthRequest } from '../../middlewares/auth.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { ApiError } from '../../utils/apiError';

const router = Router();
router.use(authenticate);

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Fast Patient Search: ?q=<patientId | phone | name>
router.get(
    '/search',
    authorizeRoles('SUPER_ADMIN', 'PHARMACY', 'RECEPTIONIST', 'DOCTOR'),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const q = String(req.query.q || '').trim();
        if (!q) throw new ApiError(400, 'Query param q (patient ID, phone, or name) is required');

        const limit = Math.min(Number(req.query.limit) || 15, 50);

        // 1. Direct exact UUID lookup (fastest - primary key index)
        if (UUID_REGEX.test(q)) {
            const patient = await prisma.user.findUnique({
                where: { id: q },
                select: {
                    id: true,
                    fullName: true,
                    phone: true,
                    email: true,
                    status: true,
                    createdAt: true,
                },
            });
            return res.status(200).json(new ApiResponse(200, patient ? [patient] : [], 'Patient search result'));
        }

        // 2. Indexed phone or name lookup
        const patients = await prisma.user.findMany({
            where: {
                role: { name: 'PATIENT' },
                OR: [
                    { phone: { contains: q } },
                    { fullName: { contains: q, mode: 'insensitive' } },
                ],
            },
            select: {
                id: true,
                fullName: true,
                phone: true,
                email: true,
                status: true,
                createdAt: true,
            },
            take: limit,
            orderBy: { createdAt: 'desc' },
        });

        res.status(200).json(new ApiResponse(200, patients, 'Patient search results'));
    })
);

export default router;
