import { RoleName } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/apiError';

const locationSelect = { select: { id: true, city: true, area: true, state: true, pincode: true } };

export const findLocationById = (id: string) => prisma.location.findUnique({ where: { id } });

export const createPharmacy = async (adminId: string, data: any) => {
    return await prisma.$transaction(async (tx) => {
        // Rule: Only one pharmacy can be Primary at a time
        if (data.isPrimary) {
            await tx.pharmacy.updateMany({
                where: { isPrimary: true },
                data: { isPrimary: false }
            });
        }

        // explicit whitelist: nothing else from the request body reaches the database
        return await tx.pharmacy.create({
            data: {
                name: data.name,
                phone: data.phone,
                email: data.email ?? null,
                line1: data.line1,
                line2: data.line2 ?? null,
                city: data.city,
                state: data.state,
                pincode: data.pincode,
                locationId: data.locationId ?? null,
                isPrimary: data.isPrimary ?? false,
                registeredById: adminId,
                approvedById: adminId,
                approvedAt: new Date(),
                status: 'ACTIVE'
            },
            include: { location: locationSelect }
        });
    });
};

export const setPrimaryPharmacy = async (pharmacyId: string) => {
    return await prisma.$transaction(async (tx) => {
        const target = await tx.pharmacy.findUnique({ where: { id: pharmacyId } });
        if (!target) throw new ApiError(404, 'Pharmacy not found');
        if (target.status !== 'ACTIVE') throw new ApiError(400, 'Only an ACTIVE pharmacy can be set as Primary');

        // 1. Unset the current primary pharmacy
        await tx.pharmacy.updateMany({
            where: { isPrimary: true },
            data: { isPrimary: false }
        });

        // 2. Set the new primary pharmacy
        return await tx.pharmacy.update({
            where: { id: pharmacyId },
            data: { isPrimary: true }
        });
    });
};

export const getAllPharmacies = async () => {
    return await prisma.pharmacy.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
        include: { location: locationSelect }
    });
};

// ---------------- Step 3A-2: owner link ----------------

export const findPharmacyById = (id: string) => prisma.pharmacy.findUnique({ where: { id } });

// returns { id, roleName } or null when the user does not exist / has no role
export const findUserWithRole = async (userId: string) => {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, roleId: true } });
    if (!user || !user.roleId) return null;
    const role = await prisma.role.findUnique({ where: { id: user.roleId } });
    return { id: user.id, roleName: role ? String(role.name) : null };
};

export const findStaff = (userId: string, pharmacyId: string) =>
    prisma.pharmacyStaff.findUnique({ where: { userId_pharmacyId: { userId, pharmacyId } } });

export const findActiveOwner = (pharmacyId: string) =>
    prisma.pharmacyStaff.findFirst({ where: { pharmacyId, staffRole: 'OWNER', isActive: true } });

export const assignOwnerWithAudit = (pharmacyId: string, userId: string, actor: { id: string; role: RoleName }) =>
    prisma.$transaction(async (tx) => {
        const staff = await tx.pharmacyStaff.create({ data: { userId, pharmacyId, staffRole: 'OWNER' } });
        await tx.auditLog.create({
            data: {
                actorId: actor.id,
                actorRole: actor.role,
                action: 'PHARMACY_OWNER_ASSIGNED',
                entityType: 'Pharmacy',
                entityId: pharmacyId,
                after: staff as any,
            },
        });
        return staff;
    });

export const findPharmaciesByStaffUser = (userId: string) =>
    prisma.pharmacy.findMany({
        where: { status: 'ACTIVE', staff: { some: { userId, isActive: true } } },
        orderBy: { createdAt: 'desc' },
        include: { location: locationSelect },
    });
