import { ApiError } from '../../utils/apiError';
import * as pharmacyRepo from './pharmacy.repository';

export const addPharmacy = async (adminId: string, data: any) => {
    try {
        return await pharmacyRepo.createPharmacy(adminId, data);
    } catch (error: any) {
        // 🔥 This will print the actual database error in your VS Code / Windsurf terminal
        console.error("🔥 PRISMA ERROR:", error); 
        throw new ApiError(500, error.message || "Failed to create pharmacy");
    }
};

export const makePrimary = async (pharmacyId: string) => {
    try {
        return await pharmacyRepo.setPrimaryPharmacy(pharmacyId);
    } catch (error: any) {
        throw new ApiError(500, error.message || "Failed to update primary pharmacy");
    }
};

export const fetchPharmacies = async () => {
    return await pharmacyRepo.getAllPharmacies();
};