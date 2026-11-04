import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { registerUser, loginUser, refreshSession, logoutSession } from './auth.service';

export const register = asyncHandler(async (req: Request, res: Response) => {
    const result = await registerUser(req.body, req.headers['user-agent'], req.ip);
    res.status(201).json(new ApiResponse(201, result, "User registered successfully"));
});

export const login = asyncHandler(async (req: Request, res: Response) => {
    const { identifier, password } = req.body;
    const result = await loginUser(identifier, password, req.headers['user-agent'], req.ip);
    res.status(200).json(new ApiResponse(200, result, "Login successful"));
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken, sessionId } = req.body;
    const result = await refreshSession(refreshToken, sessionId);
    res.status(200).json(new ApiResponse(200, result, "Tokens refreshed successfully"));
});

export const logout = asyncHandler(async (req: any, res: Response) => {
    const sessionId = req.body.sessionId || req.user?.sessionId;
    if (sessionId) {
        await logoutSession(sessionId);
    }
    res.status(200).json(new ApiResponse(200, null, "Logged out successfully"));
});