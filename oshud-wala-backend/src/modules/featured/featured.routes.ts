import { Router, Request, Response } from 'express';
import { prisma } from '../../config/prisma';
import { authenticate, authorizeRoles } from '../../middlewares/auth.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { ApiError } from '../../utils/apiError';

const router = Router();

// Public: Featured Doctors
router.get('/doctors', asyncHandler(async (_req: Request, res: Response) => {
    const doctors = await prisma.doctor.findMany({
        where: { isFeatured: true },
        include: {
            specializations: { include: { specialization: true } },
            pharmacies: {
                where: { isActive: true },
                include: { pharmacy: { select: { id: true, name: true, city: true, area: true } as any } },
            },
        },
        orderBy: [{ featuredOrder: 'asc' }, { updatedAt: 'desc' }],
    });
    res.status(200).json(new ApiResponse(200, doctors, 'Featured doctors fetched'));
}));

// Public: Featured Clinics / Pharmacies
router.get('/clinics', asyncHandler(async (_req: Request, res: Response) => {
    const clinics = await prisma.pharmacy.findMany({
        where: { isFeatured: true, status: 'ACTIVE', deletedAt: null },
        include: { location: true },
        orderBy: [{ featuredOrder: 'asc' }, { updatedAt: 'desc' }],
    });
    res.status(200).json(new ApiResponse(200, clinics, 'Featured clinics fetched'));
}));

// Super Admin: Toggle Featured Doctor
router.patch(
    '/doctors/:id',
    authenticate,
    authorizeRoles('SUPER_ADMIN'),
    asyncHandler(async (req: Request, res: Response) => {
        const { isFeatured, featuredOrder } = req.body;
        if (typeof isFeatured !== 'boolean') throw new ApiError(400, 'isFeatured (boolean) is required');

        const doctor = await prisma.doctor.update({
            where: { id: req.params.id },
            data: {
                isFeatured,
                ...(typeof featuredOrder === 'number' ? { featuredOrder } : {}),
            },
        });
        res.status(200).json(new ApiResponse(200, doctor, 'Doctor featured status updated'));
    })
);

// Super Admin: Toggle Featured Clinic / Pharmacy
router.patch(
    '/clinics/:id',
    authenticate,
    authorizeRoles('SUPER_ADMIN'),
    asyncHandler(async (req: Request, res: Response) => {
        const { isFeatured, featuredOrder } = req.body;
        if (typeof isFeatured !== 'boolean') throw new ApiError(400, 'isFeatured (boolean) is required');

        const clinic = await prisma.pharmacy.update({
            where: { id: req.params.id },
            data: {
                isFeatured,
                ...(typeof featuredOrder === 'number' ? { featuredOrder } : {}),
            },
        });
        res.status(200).json(new ApiResponse(200, clinic, 'Clinic featured status updated'));
    })
);

export default router;
