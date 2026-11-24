import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/apiError';

const getSummary = async (targetType: 'PHARMACY' | 'DOCTOR', targetId: string) => {
    const where = targetType === 'PHARMACY' ? { pharmacyId: targetId } : { doctorId: targetId };

    const [agg, grouped] = await Promise.all([
        prisma.review.aggregate({
            where,
            _avg: { rating: true },
            _count: { rating: true },
        }),
        prisma.review.groupBy({
            by: ['rating'],
            where,
            _count: { rating: true },
        }),
    ]);

    const breakdown: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    for (const g of grouped) {
        breakdown[g.rating] = g._count.rating;
    }

    return {
        averageRating: agg._avg.rating ? Number(agg._avg.rating.toFixed(1)) : 0,
        outOf: 5,
        totalReviews: agg._count.rating,
        breakdown,
    };
};

export const upsertReview = async (
    patientId: string,
    input: { targetType: 'PHARMACY' | 'DOCTOR'; targetId: string; rating: number; comment?: string }
) => {
    const { targetType, targetId, rating, comment } = input;

    if (targetType === 'PHARMACY') {
        const exists = await prisma.pharmacy.findUnique({ where: { id: targetId }, select: { id: true } });
        if (!exists) throw new ApiError(404, 'Pharmacy not found');

        const review = await prisma.review.upsert({
            where: { patientId_pharmacyId: { patientId, pharmacyId: targetId } },
            create: { patientId, targetType, pharmacyId: targetId, rating, comment },
            update: { rating, comment },
        });
        const summary = await getSummary('PHARMACY', targetId);
        return { review, summary };
    } else {
        const exists = await prisma.doctor.findUnique({ where: { id: targetId }, select: { id: true } });
        if (!exists) throw new ApiError(404, 'Doctor not found');

        const review = await prisma.review.upsert({
            where: { patientId_doctorId: { patientId, doctorId: targetId } },
            create: { patientId, targetType, doctorId: targetId, rating, comment },
            update: { rating, comment },
        });
        const summary = await getSummary('DOCTOR', targetId);
        return { review, summary };
    }
};

export const getTargetReviews = async (
    targetType: 'PHARMACY' | 'DOCTOR',
    targetId: string,
    page = 1,
    limit = 20
) => {
    const where = targetType === 'PHARMACY' ? { pharmacyId: targetId } : { doctorId: targetId };
    const skip = (page - 1) * limit;

    const [summary, reviews] = await Promise.all([
        getSummary(targetType, targetId),
        prisma.review.findMany({
            where,
            include: {
                patient: { select: { id: true, fullName: true } },
            },
            orderBy: { updatedAt: 'desc' },
            skip,
            take: limit,
        }),
    ]);

    return { summary, reviews, page, limit };
};

export const deleteReview = async (reviewId: string, requesterId: string, requesterRole: string) => {
    const review = await prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) throw new ApiError(404, 'Review not found');
    if (requesterRole !== 'SUPER_ADMIN' && review.patientId !== requesterId) {
        throw new ApiError(403, 'You can only delete your own review');
    }
    await prisma.review.delete({ where: { id: reviewId } });
    return { deleted: true, id: reviewId };
};
