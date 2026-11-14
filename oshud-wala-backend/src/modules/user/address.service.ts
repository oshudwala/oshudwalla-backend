import { ApiError } from '../../utils/apiError';
import * as addressRepo from './address.repository';

export const addAddress = async (userId: string, data: any) => {
    if (!userId) throw new ApiError(401, 'Unauthorized access');

    const totalAddresses = await addressRepo.countActiveAddresses(userId);
    
    // Jodi first address hoy, othoba user explicitly default bole
    if (totalAddresses === 0 || data.isDefault) {
        data.isDefault = true;
        if (totalAddresses > 0) {
            await addressRepo.clearDefaultAddress(userId); // Purono default clear koro
        }
    } else {
        data.isDefault = false;
    }

    return await addressRepo.createAddress(userId, data);
};

export const fetchAddresses = async (userId: string) => {
    if (!userId) throw new ApiError(401, 'Unauthorized access');
    return await addressRepo.getAddresses(userId);
};

export const modifyAddress = async (addressId: string, userId: string, data: any) => {
    if (!userId) throw new ApiError(401, 'Unauthorized access');
    
    if (data.isDefault) {
        await addressRepo.clearDefaultAddress(userId);
    }
    
    await addressRepo.updateAddress(addressId, userId, data);
    return { success: true };
};

export const removeAddress = async (addressId: string, userId: string) => {
    if (!userId) throw new ApiError(401, 'Unauthorized access');
    await addressRepo.softDeleteAddress(addressId, userId);
    return { success: true };
};