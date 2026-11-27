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
                    hasClinicService: data.hasClinicService ?? false,
                    hasMedicineService: data.hasMedicineService ?? true,
                    logoUrl: data.logoUrl ?? null,
                    isFeatured: data.isFeatured ?? false,
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
            data: { isPrimary: true, hasMedicineService: true },
            include: { location: locationSelect }
        });
    });
};

export const getPrimaryPharmacy = async () => {
    const primary = await prisma.pharmacy.findFirst({
        where: { isPrimary: true, status: 'ACTIVE' },
        include: { location: locationSelect }
    });
    if (primary) return primary;
    return await prisma.pharmacy.findFirst({
        where: { status: 'ACTIVE', hasMedicineService: true },
        include: { location: locationSelect }
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

export const updatePharmacyWithAudit = (id: string, before: any, data: any, actor: Actor, action = 'PHARMACY_UPDATED', ownerUserId?: string) =>
    prisma.$transaction(
        async (tx) => {
            const updated = await tx.pharmacy.update({ where: { id }, data, include: { location: locationSelect } });

            if (ownerUserId) {
                const userUpdate: any = {};
                if (data.name) userUpdate.fullName = data.name;
                if (data.phone) userUpdate.phone = data.phone;
                if (data.email !== undefined) userUpdate.email = data.email;
                if (Object.keys(userUpdate).length > 0) {
                    await tx.user.update({
                        where: { id: ownerUserId },
                        data: userUpdate,
                    });
                }
            }

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

// ---------------- Step 3G: Pharmacy Receptionist ----------------

export const findUserByPhoneOrOptionalEmail = (phone: string, email?: string | null) =>
    prisma.user.findFirst({
        where: { OR: email ? [{ phone }, { email }] : [{ phone }] },
        select: { id: true },
    });

export const createReceptionistWithAudit = (
    pharmacyId: string,
    userData: { fullName: string; phone: string; email: string | null; passwordHash: string; roleId: string },
    actor: Actor
) =>
    prisma.$transaction(
        async (tx) => {
            const user = await tx.user.create({
                data: userData,
                select: { id: true, fullName: true, phone: true, email: true, status: true },
            });

            const staff = await tx.pharmacyStaff.create({
                data: {
                    userId: user.id,
                    pharmacyId,
                    staffRole: 'RECEPTIONIST',
                    isActive: true,
                },
                include: {
                    user: { select: { id: true, fullName: true, phone: true, email: true, status: true } },
                },
            });

            await tx.auditLog.create({
                data: {
                    actorId: actor.id,
                    actorRole: actor.role,
                    action: 'RECEPTIONIST_CREATED',
                    entityType: 'PharmacyStaff',
                    entityId: staff.id,
                    after: { pharmacyId, staffId: staff.id, userId: user.id, phone: user.phone } as any,
                },
            });

            return staff;
        },
        { maxWait: 10000, timeout: 30000 }
    );

export const listPharmacyReceptionists = (pharmacyId: string) =>
    prisma.pharmacyStaff.findMany({
        where: { pharmacyId, staffRole: 'RECEPTIONIST' },
        orderBy: { createdAt: 'desc' },
        include: {
            user: { select: { id: true, fullName: true, phone: true, email: true, status: true } },
        },
    });

export const findReceptionistStaff = (pharmacyId: string, staffId: string) =>
    prisma.pharmacyStaff.findFirst({
        where: { id: staffId, pharmacyId, staffRole: 'RECEPTIONIST' },
    });

export const updateReceptionistStatusWithAudit = (staff: any, isActive: boolean, actor: Actor) =>
    prisma.$transaction(
        async (tx) => {
            const updated = await tx.pharmacyStaff.update({
                where: { id: staff.id },
                data: { isActive },
                include: {
                    user: { select: { id: true, fullName: true, phone: true, email: true, status: true } },
                },
            });
            await tx.auditLog.create({
                data: {
                    actorId: actor.id,
                    actorRole: actor.role,
                    action: 'RECEPTIONIST_STATUS_UPDATED',
                    entityType: 'PharmacyStaff',
                    entityId: staff.id,
                    before: { isActive: staff.isActive } as any,
                    after: { isActive: updated.isActive } as any,
                },
            });
            return updated;
        },
        { maxWait: 10000, timeout: 30000 }
    );

export const deletePharmacyAndStaff = async (pharmacyId: string, actor: Actor) =>
    prisma.$transaction(
        async (tx) => {
            const pharmacy = await tx.pharmacy.findUnique({
                where: { id: pharmacyId },
                include: { staff: true },
            });
            if (!pharmacy) throw new ApiError(404, 'Pharmacy or clinic not found');

            const staffUserIds = pharmacy.staff.map((s) => s.userId);

            // 1. Clean up orders referencing this pharmacy
            const fallback = await tx.pharmacy.findFirst({ where: { isPrimary: true, NOT: { id: pharmacyId } } });
            if (fallback) {
                await tx.order.updateMany({
                    where: { pharmacyId },
                    data: { pharmacyId: fallback.id },
                });
            } else {
                await tx.order.deleteMany({
                    where: { pharmacyId },
                });
            }

            // 2. Clean up prescriptions referencing this pharmacy
            await tx.prescription.updateMany({
                where: { pharmacyId },
                data: { pharmacyId: null },
            });

            // 3. Delete pickup QR codes
            await tx.pickupQr.deleteMany({
                where: { pharmacyId },
            });

            // 4. Delete commission rules
            await tx.commissionRule.deleteMany({
                where: { pharmacyId },
            });

            // 5. Delete reviews
            await tx.review.deleteMany({
                where: { pharmacyId },
            });

            // 6. Delete opening hours and holidays
            await tx.pharmacyOpeningHour.deleteMany({
                where: { pharmacyId },
            });
            await tx.pharmacyHoliday.deleteMany({
                where: { pharmacyId },
            });

            // 7. Delete pharmacy doctors & their appointments/schedules
            const pdRows = await tx.pharmacyDoctor.findMany({
                where: { pharmacyId },
                select: { id: true },
            });
            for (const pd of pdRows) {
                await tx.appointmentSlot.deleteMany({ where: { pharmacyDoctorId: pd.id } });
                await tx.appointment.deleteMany({ where: { pharmacyDoctorId: pd.id } });
                await tx.queueDay.deleteMany({ where: { pharmacyDoctorId: pd.id } });
                await tx.doctorSchedule.deleteMany({ where: { pharmacyDoctorId: pd.id } });
                await tx.scheduleException.deleteMany({ where: { pharmacyDoctorId: pd.id } });
                await tx.receptionistDoctor.deleteMany({ where: { pharmacyDoctorId: pd.id } });
            }
            await tx.pharmacyDoctor.deleteMany({ where: { pharmacyId } });

            // 8. Delete pharmacy wallet & ledger entries
            const pWallet = await tx.wallet.findUnique({ where: { pharmacyId } });
            if (pWallet) {
                await tx.ledgerEntry.deleteMany({ where: { walletId: pWallet.id } });
                await tx.withdrawalRequest.deleteMany({ where: { walletId: pWallet.id } });
                await tx.wallet.delete({ where: { id: pWallet.id } });
            }

            // 9. Delete staff links
            await tx.pharmacyStaff.deleteMany({ where: { pharmacyId } });

            // 10. Delete the pharmacy from pharmacies table
            await tx.pharmacy.delete({ where: { id: pharmacyId } });

            // 11. Delete associated users from users table
            for (const userId of staffUserIds) {
                const uWallets = await tx.wallet.findMany({ where: { userId } });
                for (const uw of uWallets) {
                    await tx.ledgerEntry.deleteMany({ where: { walletId: uw.id } });
                    await tx.withdrawalRequest.deleteMany({ where: { walletId: uw.id } });
                    await tx.wallet.delete({ where: { id: uw.id } });
                }

                await tx.session.deleteMany({ where: { userId } });
                await tx.passwordResetToken.deleteMany({ where: { userId } });
                await tx.patientProfile.deleteMany({ where: { userId } });
                await tx.address.deleteMany({ where: { userId } });
                await tx.notification.deleteMany({ where: { userId } });
                await tx.notificationSetting.deleteMany({ where: { userId } });
                await tx.notificationPreference.deleteMany({ where: { userId } });
                await tx.deviceToken.deleteMany({ where: { userId } });
                await tx.receptionistDoctor.deleteMany({ where: { receptionistUserId: userId } });
                await tx.auditLog.updateMany({ where: { actorId: userId }, data: { actorId: null } });

                try {
                    await tx.user.delete({ where: { id: userId } });
                } catch (delUserErr) {
                    console.warn(`User ${userId} delete notice:`, delUserErr);
                }
            }

            // 12. Create audit log
            await tx.auditLog.create({
                data: {
                    actorId: actor.id,
                    actorRole: actor.role,
                    action: 'PHARMACY_DELETED',
                    entityType: 'Pharmacy',
                    entityId: pharmacyId,
                    before: pharmacy as any,
                },
            });

            return { id: pharmacyId, deletedStaffUsers: staffUserIds };
        },
        { maxWait: 15000, timeout: 45000 }
    );
