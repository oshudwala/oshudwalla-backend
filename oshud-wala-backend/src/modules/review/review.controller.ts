import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { AuthRequest } from '../../middlewares/auth.middleware';
import * as reviewService from './review.service';

export const submitReview = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await reviewService.upsertReview(req.user!.userId, req.body);
    res.status(200).json(new ApiResponse(200, data, 'Rating submitted successfully'));
});

export const getPharmacyReviews = asyncHandler(async (req: Request, res: Response) => {
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const data = await reviewService.getTargetReviews('PHARMACY', req.params.pharmacyId, page, limit);
    res.status(200).json(new ApiResponse(200, data, 'Pharmacy ratings fetched'));
});

export const getDoctorReviews = asyncHandler(async (req: Request, res: Response) => {
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const data = await reviewService.getTargetReviews('DOCTOR', req.params.doctorId, page, limit);
    res.status(200).json(new ApiResponse(200, data, 'Doctor ratings fetched'));
});

export const deleteReview = asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await reviewService.deleteReview(req.params.id, req.user!.userId, req.user!.role);
    res.status(200).json(new ApiResponse(200, data, 'Review deleted'));
});
