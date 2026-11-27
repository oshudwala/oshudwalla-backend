import bcrypt from 'bcrypt';
import { RoleName } from '@prisma/client';
import { ApiError } from '../../utils/apiError';
import * as repo from './rider.repository';

type Actor = { id: string; role: RoleName };

export const createRider = async (body: any, actor: Actor) => {
    const phone = String(body.phone).trim();
    const email = String(body.email).trim().toLowerCase();

    const role = await repo.findRoleByName('RIDER');
    if (!role) throw new ApiError(500, 'RIDER role not found in database');

    if (await repo.findUserByPhoneOrEmail(phone, email)) {
        throw new ApiError(409, 'A user with this phone or email already exists');
    }

    const passwordHash = await bcrypt.hash(body.password, 10);

    try {
        return await repo.createRiderTx(
            {
                fullName: String(body.fullName).trim(),
                phone,
                email,
                passwordHash,
                roleId: role.id,
            },
            {
                vehicleType: body.vehicleType ? String(body.vehicleType).trim() : null,
                vehicleNumber: body.vehicleNumber ? String(body.vehicleNumber).trim() : null,
                licenseNumber: body.licenseNumber ? String(body.licenseNumber).trim() : null,
            },
            actor
        );
    } catch (error: any) {
        if (error?.code === 'P2002') throw new ApiError(409, 'A user with this phone or email already exists');
        throw new ApiError(500, 'Failed to create rider');
    }
};

export const listRiders = async () => repo.listRiders();

export const updateRiderStatus = async (userId: string, body: any, actor: Actor) => {
    const existing = await repo.findRiderByUserId(userId);
    if (!existing) throw new ApiError(404, 'Rider not found');
    const data: any = {};
    if (body.status !== undefined) data.status = body.status;
    if (body.kycStatus !== undefined) data.kycStatus = body.kycStatus;
    return await repo.updateRiderStatusTx(userId, existing, data, actor);
};

export const updateRider = async (id: string, body: any, actor: Actor) => {
    const existing = await repo.findRiderByIdOrUserId(id);
    if (!existing) throw new ApiError(404, 'Rider not found');

    const profileData: any = {};
    if (body.vehicleType !== undefined) profileData.vehicleType = body.vehicleType ? String(body.vehicleType).trim() : null;
    if (body.vehicleNumber !== undefined) profileData.vehicleNumber = body.vehicleNumber ? String(body.vehicleNumber).trim() : null;
    if (body.licenseNumber !== undefined) profileData.licenseNumber = body.licenseNumber ? String(body.licenseNumber).trim() : null;
    if (body.status !== undefined) profileData.status = body.status;
    if (body.kycStatus !== undefined) profileData.kycStatus = body.kycStatus;

    const userData: any = {};
    if (body.fullName !== undefined) userData.fullName = String(body.fullName).trim();
    if (body.phone !== undefined) {
        const cleanPhone = String(body.phone).replace(/[^0-9]/g, '');
        if (cleanPhone && cleanPhone !== existing.user?.phone) {
            const conflict = await repo.findUserByPhoneOrEmail(cleanPhone, '');
            if (conflict && conflict.id !== existing.userId) {
                throw new ApiError(409, 'Phone number is already registered to another account');
            }
        }
        userData.phone = cleanPhone;
    }
    if (body.email !== undefined) {
        const cleanEmail = body.email ? String(body.email).trim().toLowerCase() : null;
        if (cleanEmail && cleanEmail !== existing.user?.email) {
            const conflict = await repo.findUserByPhoneOrEmail('', cleanEmail);
            if (conflict && conflict.id !== existing.userId) {
                throw new ApiError(409, 'Email address is already registered to another account');
            }
        }
        userData.email = cleanEmail;
    }

    return await repo.updateRiderTx(id, profileData, userData, actor);
};
