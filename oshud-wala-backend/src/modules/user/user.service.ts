import { ApiError } from '../../utils/apiError';
import * as userRepo from './user.repository';

export const fetchProfile = async (userId: string) => {
    if (!userId) throw new ApiError(401, 'Unauthorized access');
    const profile = await userRepo.getUserProfile(userId);
    if (!profile) throw new ApiError(404, 'User profile not found');
    return profile;
};

export const modifyProfile = async (userId: string, data: any) => {
    if (!userId) throw new ApiError(401, 'Unauthorized access');

    // Separate User fields and PatientProfile fields
    const { fullName, email, ...patientData } = data;
    
    const userData: any = {};
    if (fullName !== undefined) userData.fullName = fullName;
    if (email !== undefined) userData.email = email;

    return await userRepo.updateUserAndPatientProfile(userId, userData, patientData);
};