import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { ApiError } from '../utils/apiError';
import { asyncHandler } from '../utils/asyncHandler';

export const validate = (schema: AnyZodObject) => 
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        try {
            await schema.parseAsync({
                body: req.body,
                query: req.query,
                params: req.params,
            });
            next();
        } catch (error: any) {
            if (error instanceof ZodError) {
                const formattedErrors = error.errors.map(err => ({
                    field: err.path.join('.'),
                    message: err.message
                }));
                throw new ApiError(400, 'Validation Error', formattedErrors);
            }
            throw new ApiError(500, 'Internal Validation Error');
        }
    });