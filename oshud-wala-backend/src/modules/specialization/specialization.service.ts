import { ApiError } from '../../utils/apiError';
import * as specRepo from './specialization.repository';

export const addSpecialization = async (data: any) => {
    try {
        return await specRepo.createSpecialization(data);
    } catch (error: any) {
        // Jodi same name er specialization already thake (Unique constraint error)
        if (error.code === 'P2002') {
            throw new ApiError(400, 'This specialization already exists');
        }
        throw new ApiError(500, 'Error creating specialization');
    }
};

export const fetchSpecializations = async () => {
    return await specRepo.getAllSpecializations();
};