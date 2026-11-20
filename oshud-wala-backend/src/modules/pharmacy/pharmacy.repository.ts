import { RoleName } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/apiError';

const locationSelect = { select: { id: true, city: true, area: true, state: true, pincode: true } };

type Actor = { id: string; role: RoleName };

export const findLocationById = (id: string) => prisma.location.findUnique({ where: { id } });

export const findRoleByName = (name: RoleName) => prisma.role.findUnique({ where: { name } });

export const findUserByPhoneOrEmail = (phone: string, email: string) =>
    prisma.user.findFirst({ where: { OR: [{ phone }, { email }] }, select: { id: true } });

// One transaction: owner user + pharmacy + owner link + audit log. If anything fails, nothing is saved.
export const createPharmacyWithOwner = (data: any, owner: any, actor: Actor) =>
    prisma.$transaction(
        async (tx) => {
            // Rule: Only one pharmacy can be Primary at a time
            if (data.isPrimary) {
                await tx.pharmacy.updateMany({ where: { isPrimary: true }, data: { isPrimary: false } });
            }

            const user = await tx.user.create({
                data: {
                    fullName: owner.fullName,
                    phone: owner.phone,
                    email: owner.email,
                    passwordHash: owner.passwordHash,
                    roleId: owner.roleId,
                },
                select: { id: true, fullName: true, phone: true, email: true },
            });

            // explicit whitelist: nothing else from the request body reaches the database
            const pharmacy = await tx.pharmacy.create({
                data: {
                    name: data.name,
                    nameBn: data.nameBn ?? null,
                    nameHi: data.nameHi ?? null,
                    phone: data.phone,
                    email: data.email,
                    line1: data.line1,
                    line2: data.line2 ?? null,
                    city: data.city,
                    state: data.state,
                    pincode: data.pincode,
                    locationId: data.locationId,
                    latitude: data.latitude ?? null,
                    longitude: data.longitude ?? null,
                    isPrimary: data.isPrimary ?? false,
                    registeredById: actor.id,
                    approvedById: actor.id,
                    approvedAt: new Date(),
                    status: 'ACTIVE',
                },
                include: { location: locationSelect },
            });

            await tx.pharmacyStaff.create({
                data: { userId: user.id, pharmacyId: pharmacy.id, staffRole: 'OWNER' },
            });

            await tx.auditLog.create({
                data: {
                    actorId: actor.id,
                    actorRole: actor.role,
                    action: 'PHARMACY_CREATED',
                    entityType: 'Pharmacy',
                    entityId: pharmacy.id,
                    after: { ...pharmacy, ownerUserId: user.id } as any,
                },
            });

            return { pharmacy, owner: user };
        },
        { maxWait: 10000, timeout: 30000 }
    );

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

export const findPharmaciesByStaffUser = (userId: string) =>
    prisma.pharmacy.findMany({
        where: { status: 'ACTIVE', staff: { some: { userId, isActive: true } } },
        orderBy: { createdAt: 'desc' },
        include: { location: locationSelect },
    });

// ---------------- Step 3B-2: profile update ----------------

export const findPharmacyById = (id: string) => prisma.pharmacy.findUnique({ where: { id } });

export const findActiveOwnerLink = (userId: string, pharmacyId: string) =>
    prisma.pharmacyStaff.findFirst({ where: { userId, pharmacyId, staffRole: 'OWNER', isActive: true } });

export const updatePharmacyWithAudit = (id: string, before: any, data: any, actor: Actor, action = 'PHARMACY_UPDATED') =>
    prisma.$transaction(
        async (tx) => {
            const updated = await tx.pharmacy.update({ where: { id }, data, include: { location: locationSelect } });
            await tx.auditLog.create({
                data: {
                    actorId: actor.id,
                    actorRole: actor.role,
                    action,
                    entityType: 'Pharmacy',
                    entityId: id,
                    before: before as any,
                    after: updated as any,
                },
            });
            return updated;
        },
        { maxWait: 10000, timeout: 30000 }
    );

// ---------------- Step 3E: Opening hours & holidays ----------------

export const getPharmacyHoursAndHolidays = async (pharmacyId: string) => {
    const [hours, holidays] = await prisma.$transaction([
        prisma.pharmacyOpeningHour.findMany({
            where: { pharmacyId },
            orderBy: { dayOfWeek: 'asc' },
        }),
        prisma.pharmacyHoliday.findMany({
            where: { pharmacyId },
            orderBy: { holidayDate: 'asc' },
        }),
    ]);
    return { hours, holidays };
};

export const replacePharmacyHoursWithAudit = (pharmacyId: string, hours: any[], actor: Actor) =>
    prisma.$transaction(
        async (tx) => {
            const before = await tx.pharmacyOpeningHour.findMany({
                where: { pharmacyId },
                orderBy: { dayOfWeek: 'asc' },
            });
            await tx.pharmacyOpeningHour.deleteMany({ where: { pharmacyId } });
            await tx.pharmacyOpeningHour.createMany({
                data: hours.map((h) => ({
                    pharmacyId,
                    dayOfWeek: h.dayOfWeek,
                    isClosed: Boolean(h.isClosed),
                    openMinute: h.isClosed ? null : h.openMinute,
                    closeMinute: h.isClosed ? null : h.closeMinute,
                })),
            });
            const after = await tx.pharmacyOpeningHour.findMany({
                where: { pharmacyId },
                orderBy: { dayOfWeek: 'asc' },
            });
            await tx.auditLog.create({
                data: {
                    actorId: actor.id,
                    actorRole: actor.role,
                    action: 'PHARMACY_HOURS_UPDATED',
                    entityType: 'Pharmacy',
                    entityId: pharmacyId,
                    before: before as any,
                    after: after as any,
                },
            });
            return after;
        },
        { maxWait: 10000, timeout: 30000 }
    );

export const createPharmacyHolidayWithAudit = (pharmacyId: string, holidayDate: Date, reason: string | null, actor: Actor) =>
    prisma.$transaction(
        async (tx) => {
            const created = await tx.pharmacyHoliday.create({
                data: { pharmacyId, holidayDate, reason },
            });
            await tx.auditLog.create({
                data: {
                    actorId: actor.id,
                    actorRole: actor.role,
                    action: 'PHARMACY_HOLIDAY_ADDED',
                    entityType: 'Pharmacy',
                    entityId: pharmacyId,
                    after: created as any,
                },
            });
            return created;
        },
        { maxWait: 10000, timeout: 30000 }
    );

export const findPharmacyHoliday = (pharmacyId: string, holidayId: string) =>
    prisma.pharmacyHoliday.findFirst({ where: { id: holidayId, pharmacyId } });

export const deletePharmacyHolidayWithAudit = (pharmacyId: string, holiday: any, actor: Actor) =>
    prisma.$transaction(
        async (tx) => {
            await tx.pharmacyHoliday.delete({ where: { id: holiday.id } });
            await tx.auditLog.create({
                data: {
                    actorId: actor.id,
                    actorRole: actor.role,
                    action: 'PHARMACY_HOLIDAY_REMOVED',
                    entityType: 'Pharmacy',
                    entityId: pharmacyId,
                    before: holiday as any,
                },
            });
        },
        { maxWait: 10000, timeout: 30000 }
    );
