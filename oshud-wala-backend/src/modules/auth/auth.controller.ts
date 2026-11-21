import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { registerUser, loginUser, refreshSession, logoutSession, sendRegistrationOtp, registerPatientWithOtp, sendPatientLoginOtp, verifyPatientLoginOtp } from './auth.service';

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
export const sendOtp = asyncHandler(async (req: Request, res: Response) => {
    const result = await sendRegistrationOtp(req.body.phone);
    res.status(200).json(new ApiResponse(200, result, "OTP sent successfully"));
});

export const registerWithOtp = asyncHandler(async (req: Request, res: Response) => {
    const result = await registerPatientWithOtp(req.body, req.headers['user-agent'], req.ip);
    res.status(201).json(new ApiResponse(201, result, "Patient registered and verified successfully"));
});

export const sendLoginOtp = asyncHandler(async (req: Request, res: Response) => {
    const result = await sendPatientLoginOtp(req.body.phone);
    res.status(200).json(new ApiResponse(200, result, "Login OTP sent successfully"));
});

export const verifyLoginOtp = asyncHandler(async (req: Request, res: Response) => {
    const { phone, otp } = req.body;
    const result = await verifyPatientLoginOtp(phone, otp, req.headers['user-agent'], req.ip);
    res.status(200).json(new ApiResponse(200, result, "Login successful"));
});
