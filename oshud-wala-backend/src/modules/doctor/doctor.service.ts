import { ApiError } from '../../utils/apiError';
import * as doctorRepo from './doctor.repository';

export const addDoctor = async (pharmacyId: string, doctorData: any) => {
    try {
        return await doctorRepo.onboardDoctorToPharmacy(pharmacyId, doctorData);
    } catch (error: any) {
        if (error instanceof ApiError) throw error;
        console.error('Add Doctor Error:', error);
        throw new ApiError(500, 'Failed to onboard doctor');
    }
};

export const fetchPharmacyDoctors = async (pharmacyId: string) => {
    return await doctorRepo.getPharmacyDoctors(pharmacyId);
};