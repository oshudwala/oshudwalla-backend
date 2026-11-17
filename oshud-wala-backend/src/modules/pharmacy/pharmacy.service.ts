import { ApiError } from '../../utils/apiError';
import * as pharmacyRepo from './pharmacy.repository';

export const addPharmacy = async (adminId: string, data: any) => {
    try {
        let { city, state, pincode } = data;

        if (data.locationId) {
            const loc = await pharmacyRepo.findLocationById(data.locationId);
            if (!loc) throw new ApiError(404, 'Location not found');
            if (!loc.isActive) throw new ApiError(400, 'Location is inactive');
            // city/state/pincode always come from the official Location master
            city = loc.city;
            state = loc.state;
            pincode = loc.pincode;
        }

        return await pharmacyRepo.createPharmacy(adminId, { ...data, city, state, pincode });
    } catch (error: any) {
        if (error instanceof ApiError) throw error;
        console.error('Create pharmacy error:', error);
        throw new ApiError(500, 'Failed to create pharmacy');
    }
};

export const makePrimary = async (pharmacyId: string) => {
    try {
        return await pharmacyRepo.setPrimaryPharmacy(pharmacyId);
    } catch (error: any) {
        if (error instanceof ApiError) throw error;
        console.error('Set primary pharmacy error:', error);
        throw new ApiError(500, 'Failed to update primary pharmacy');
    }
};

export const fetchPharmacies = async () => {
    return await pharmacyRepo.getAllPharmacies();
};
