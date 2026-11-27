import { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { getApitxtBalance } from './sms.service';

export const checkSmsBalance = asyncHandler(async (req: AuthRequest, res: Response) => {
    const queryKey = typeof req.query.authkey === 'string' ? req.query.authkey : undefined;
    const bodyKey = typeof req.body?.authkey === 'string' ? req.body.authkey : undefined;
    const headerKey = typeof req.headers['authkey'] === 'string' ? req.headers['authkey'] : undefined;

    const overrideKey = bodyKey || queryKey || headerKey;

    const data = await getApitxtBalance(overrideKey);
    res.status(200).json(new ApiResponse(200, data, 'APITxT SMS balance fetched successfully'));
});