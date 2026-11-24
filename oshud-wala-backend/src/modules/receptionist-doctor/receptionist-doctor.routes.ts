import { Router, Response } from 'express';
import { prisma } from '../../config/prisma';
import { authenticate, authorizeRoles, AuthRequest } from '../../middlewares/auth.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { ApiError } from '../../utils/apiError';

const router = Router();
router.use(authenticate);

// Assign one or more doctors (pharmacyDoctorIds) to a Receptionist
router.post(
    '/assign',
    authorizeRoles('SUPER_ADMIN', 'PHARMACY'),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const { receptionistUserId, pharmacyDoctorIds } = req.body;
        if (!receptionistUserId || !Array.isArray(pharmacyDoctorIds) || pharmacyDoctorIds.length === 0) {
            throw new ApiError(400, 'receptionistUserId and pharmacyDoctorIds (non-empty array) are required');
        }

        const results = await prisma.$transaction(
            pharmacyDoctorIds.map((pharmacyDoctorId: string) =>
                prisma.receptionistDoctor.upsert({
                    where: {
                        receptionistUserId_pharmacyDoctorId: { receptionistUserId, pharmacyDoctorId },
                    },
                    create: { receptionistUserId, pharmacyDoctorId, isActive: true },
                    update: { isActive: true },
                })
            )
        );

        res.status(200).json(new ApiResponse(200, results, 'Doctors assigned to receptionist'));
    })
);

// Unassign a doctor from a Receptionist
router.delete(
    '/unassign',
    authorizeRoles('SUPER_ADMIN', 'PHARMACY'),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const { receptionistUserId, pharmacyDoctorId } = req.body;
        if (!receptionistUserId || !pharmacyDoctorId) {
            throw new ApiError(400, 'receptionistUserId and pharmacyDoctorId are required');
        }

        await prisma.receptionistDoctor.deleteMany({
            where: { receptionistUserId, pharmacyDoctorId },
        });

        res.status(200).json(new ApiResponse(200, { unassigned: true }, 'Doctor unassigned from receptionist'));
    })
);

// Receptionist: Fast lookup of MY assigned doctors
router.get(
    '/my-doctors',
    authorizeRoles('RECEPTIONIST'),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const list = await prisma.receptionistDoctor.findMany({
            where: { receptionistUserId: req.user!.userId, isActive: true },
            include: {
                pharmacyDoctor: {
                    include: {
                        doctor: true,
                        pharmacy: { select: { id: true, name: true } },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        res.status(200).json(new ApiResponse(200, list, 'Assigned doctors fetched'));
    })
);

// Admin / Pharmacy: View doctors assigned to a specific receptionist
router.get(
    '/:receptionistUserId',
    authorizeRoles('SUPER_ADMIN', 'PHARMACY'),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const list = await prisma.receptionistDoctor.findMany({
            where: { receptionistUserId: req.params.receptionistUserId, isActive: true },
            include: {
                pharmacyDoctor: {
                    include: {
                        doctor: true,
                        pharmacy: { select: { id: true, name: true } },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        res.status(200).json(new ApiResponse(200, list, 'Receptionist doctors fetched'));
    })
);

export default router;
