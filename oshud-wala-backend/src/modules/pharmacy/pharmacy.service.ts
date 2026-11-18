import { RoleName } from '@prisma/client';
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

// ---------------- Step 3A-2: owner link ----------------

export const assignOwner = async (pharmacyId: string, userId: string, actor: { id: string; role: RoleName }) => {
    const pharmacy = await pharmacyRepo.findPharmacyById(pharmacyId);
    if (!pharmacy) throw new ApiError(404, 'Pharmacy not found');
    if (pharmacy.status !== 'ACTIVE') throw new ApiError(400, 'Pharmacy is not ACTIVE');

    const user = await pharmacyRepo.findUserWithRole(userId);
    if (!user) throw new ApiError(404, 'User not found');
    // we never change the user's role here; Super Admin must first give the PHARMACY role
    if (user.roleName !== 'PHARMACY') throw new ApiError(400, 'User must have the PHARMACY role');

    if (await pharmacyRepo.findStaff(userId, pharmacyId)) {
        throw new ApiError(409, 'User is already linked to this pharmacy');
    }
    if (await pharmacyRepo.findActiveOwner(pharmacyId)) {
        throw new ApiError(409, 'This pharmacy already has an owner');
    }

    try {
        return await pharmacyRepo.assignOwnerWithAudit(pharmacyId, userId, actor);
    } catch (error: any) {
        // two requests at the same moment: database unique constraint catches the second one
        if (error?.code === 'P2002') throw new ApiError(409, 'User is already linked to this pharmacy');
        console.error('Assign pharmacy owner error:', error);
        throw new ApiError(500, 'Failed to assign pharmacy owner');
    }
};

export const fetchMyPharmacies = async (userId: string) => {
    return await pharmacyRepo.findPharmaciesByStaffUser(userId);
};
