import bcrypt from 'bcrypt';
import { RoleName } from '@prisma/client';
import { ApiError } from '../../utils/apiError';
import * as pharmacyRepo from './pharmacy.repository';

type Actor = { id: string; role: RoleName };

export const addPharmacy = async (actor: Actor, data: any) => {
    try {
        const ownerEmail = String(data.ownerEmail).trim().toLowerCase();
        const phone = String(data.phone).trim();

        // 1. Location must exist and be active; city/state/pincode always come from it
        const loc = await pharmacyRepo.findLocationById(data.locationId);
        if (!loc) throw new ApiError(404, 'Location not found');
        if (!loc.isActive) throw new ApiError(400, 'Location is inactive');

        // 2. PHARMACY role must exist in the database
        const role = await pharmacyRepo.findRoleByName('PHARMACY');
        if (!role) throw new ApiError(500, 'Role setup incomplete in database');

        // 3. Owner phone or email must not belong to any existing user
        if (await pharmacyRepo.findUserByPhoneOrEmail(phone, ownerEmail)) {
            throw new ApiError(409, 'A user with this phone or email already exists');
        }

        // 4. Hash the password (the plain password is never stored or returned)
        const passwordHash = await bcrypt.hash(data.ownerPassword, 10);

        // 5. One transaction creates owner, pharmacy, link and audit log
        const result = await pharmacyRepo.createPharmacyWithOwner(
            {
                name: String(data.name).trim(),
                phone,
                email: ownerEmail,
                line1: String(data.line1).trim(),
                line2: data.line2 ? String(data.line2).trim() : null,
                city: loc.city,
                state: loc.state,
                pincode: loc.pincode,
                locationId: loc.id,
                latitude: data.latitude ?? null,
                longitude: data.longitude ?? null,
                isPrimary: data.isPrimary ?? false,
            },
            {
                fullName: String(data.ownerName).trim(),
                phone,
                email: ownerEmail,
                passwordHash,
                roleId: role.id,
            },
            actor
        );

        return { ...result.pharmacy, owner: result.owner };
    } catch (error: any) {
        if (error instanceof ApiError) throw error;
        // two requests at the same moment: the database unique constraint catches the second one
        if (error?.code === 'P2002') throw new ApiError(409, 'A user with this phone or email already exists');
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

export const fetchMyPharmacies = async (userId: string) => {
    return await pharmacyRepo.findPharmaciesByStaffUser(userId);
};
