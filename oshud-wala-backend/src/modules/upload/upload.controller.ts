import { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { ApiError } from '../../utils/apiError';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { uploadBufferToCloudinary } from './upload.service';

export const uploadSingle = asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.file) throw new ApiError(400, 'File is required (field name: file)');
    const folder = (req.body?.folder || req.query?.folder) as string | undefined;
    const data = await uploadBufferToCloudinary(req.file, folder);
    res.status(201).json(new ApiResponse(201, data, 'File uploaded successfully'));
});

export const uploadMultiple = asyncHandler(async (req: AuthRequest, res: Response) => {
    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) throw new ApiError(400, 'At least one file is required (field name: files)');
    const folder = (req.body?.folder || req.query?.folder) as string | undefined;
    const data = await Promise.all(files.map((f) => uploadBufferToCloudinary(f, folder)));
    res.status(201).json(new ApiResponse(201, data, 'Files uploaded successfully'));
});
