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
                nameBn: data.nameBn ? String(data.nameBn).trim() : null,
                nameHi: data.nameHi ? String(data.nameHi).trim() : null,
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
                hasClinicService: data.hasClinicService ?? false,
                hasMedicineService: data.hasMedicineService ?? true,
                logoUrl: data.logoUrl ? String(data.logoUrl).trim() : null,
                isFeatured: data.isFeatured ?? false,
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

// ---------------- Step 3B-2: profile update ----------------

export const updatePharmacy = async (id: string, body: any, actor: Actor) => {
    const existing = await pharmacyRepo.findPharmacyById(id);
    if (!existing) throw new ApiError(404, 'Pharmacy not found');
    if (existing.status !== 'ACTIVE') throw new ApiError(400, 'Pharmacy is not ACTIVE');

    // Super Admin can edit any pharmacy. A PHARMACY user can edit only the pharmacy where they are an active OWNER.
    // explicit whitelist: status, isPrimary, city, locationId and anything else in the body are ignored
    const data: any = {};
    if (body.name !== undefined) data.name = String(body.name).trim();
    if (body.nameBn !== undefined) data.nameBn = body.nameBn ? String(body.nameBn).trim() : null;
    if (body.nameHi !== undefined) data.nameHi = body.nameHi ? String(body.nameHi).trim() : null;
    if (body.phone !== undefined) data.phone = String(body.phone).trim();
    if (body.line1 !== undefined) data.line1 = String(body.line1).trim();
    if (body.line2 !== undefined) data.line2 = body.line2 ? String(body.line2).trim() : null;
    if (body.latitude !== undefined) {
        data.latitude = body.latitude;
        data.longitude = body.longitude;
    }

    try {
        return await pharmacyRepo.updatePharmacyWithAudit(id, existing, data, actor);
    } catch (error: any) {
        console.error('Update pharmacy error:', error);
        throw new ApiError(500, 'Failed to update pharmacy');
    }
};

// ---------------- Step 3B-3: Super Admin location/status update ----------------

export const adminUpdatePharmacy = async (id: string, body: any, actor: Actor) => {
    const existing = await pharmacyRepo.findPharmacyById(id);
    if (!existing) throw new ApiError(404, 'Pharmacy not found');

    const data: any = {};

    if (body.locationId !== undefined) {
        const loc = await pharmacyRepo.findLocationById(body.locationId);
        if (!loc) throw new ApiError(404, 'Location not found');
        if (!loc.isActive) throw new ApiError(400, 'Location is inactive');
        data.locationId = loc.id;
        data.city = loc.city;
        data.state = loc.state;
        data.pincode = loc.pincode;
    }

    if (body.status !== undefined) {
        if (body.status === 'SUSPENDED' && existing.isPrimary) {
            throw new ApiError(400, 'Cannot suspend the Primary Pharmacy. Set another pharmacy as Primary first.');
        }
        data.status = body.status;
    }

    if (body.isFeatured !== undefined) data.isFeatured = body.isFeatured;
    if (body.featuredOrder !== undefined) data.featuredOrder = body.featuredOrder;
    if (body.hasClinicService !== undefined) data.hasClinicService = body.hasClinicService;
    if (body.hasMedicineService !== undefined) data.hasMedicineService = body.hasMedicineService;

    try {
        return await pharmacyRepo.updatePharmacyWithAudit(id, existing, data, actor, 'PHARMACY_ADMIN_UPDATED');
    } catch (error: any) {
        console.error('Admin update pharmacy error:', error);
        throw new ApiError(500, 'Failed to update pharmacy');
    }
};

// ---------------- Step 3C: Pharmacy media (logo, cover, gallery) ----------------

export const updatePharmacyMedia = async (id: string, body: any, actor: Actor) => {
    const existing = await pharmacyRepo.findPharmacyById(id);
    if (!existing) throw new ApiError(404, 'Pharmacy not found');
    if (existing.status !== 'ACTIVE') throw new ApiError(400, 'Pharmacy is not ACTIVE');

    if (actor.role !== 'SUPER_ADMIN') {
        const link = await pharmacyRepo.findActiveOwnerLink(actor.id, id);
        if (!link) throw new ApiError(403, 'You can only edit your own pharmacy');
    }

    const data: any = {};
    if (body.logoUrl !== undefined) data.logoUrl = body.logoUrl;
    if (body.coverUrl !== undefined) data.coverUrl = body.coverUrl;
    if (body.galleryUrls !== undefined) data.galleryUrls = body.galleryUrls;

    try {
        return await pharmacyRepo.updatePharmacyWithAudit(id, existing, data, actor, 'PHARMACY_MEDIA_UPDATED');
    } catch (error: any) {
        console.error('Update pharmacy media error:', error);
        throw new ApiError(500, 'Failed to update pharmacy media');
    }
};

// ---------------- Step 3D: Clinic / Medicine service toggle ----------------

export const updatePharmacyServices = async (id: string, body: any, actor: Actor) => {
    const existing = await pharmacyRepo.findPharmacyById(id);
    if (!existing) throw new ApiError(404, 'Pharmacy not found');
    if (existing.status !== 'ACTIVE') throw new ApiError(400, 'Pharmacy is not ACTIVE');

    if (actor.role !== 'SUPER_ADMIN') {
        const link = await pharmacyRepo.findActiveOwnerLink(actor.id, id);
        if (!link) throw new ApiError(403, 'You can only edit your own pharmacy');
    }

    const nextClinic = body.hasClinicService !== undefined ? body.hasClinicService : existing.hasClinicService;
    const nextMedicine = body.hasMedicineService !== undefined ? body.hasMedicineService : existing.hasMedicineService;

    if (!nextClinic && !nextMedicine) {
        throw new ApiError(400, 'At least one service (Clinic or Medicine) must remain enabled');
    }

    const data: any = {};
    if (body.hasClinicService !== undefined) data.hasClinicService = body.hasClinicService;
    if (body.hasMedicineService !== undefined) data.hasMedicineService = body.hasMedicineService;

    try {
        return await pharmacyRepo.updatePharmacyWithAudit(id, existing, data, actor, 'PHARMACY_SERVICES_UPDATED');
    } catch (error: any) {
        console.error('Update pharmacy services error:', error);
        throw new ApiError(500, 'Failed to update pharmacy services');
    }
};

// ---------------- Step 3E: Opening hours & holidays ----------------

const assertCanEditPharmacy = async (id: string, actor: Actor) => {
    const existing = await pharmacyRepo.findPharmacyById(id);
    if (!existing) throw new ApiError(404, 'Pharmacy not found');
    if (existing.status !== 'ACTIVE') throw new ApiError(400, 'Pharmacy is not ACTIVE');
    if (actor.role !== 'SUPER_ADMIN') {
        const link = await pharmacyRepo.findActiveOwnerLink(actor.id, id);
        if (!link) throw new ApiError(403, 'You can only edit your own pharmacy');
    }
    return existing;
};

export const fetchPharmacyHours = async (id: string) => {
    const existing = await pharmacyRepo.findPharmacyById(id);
    if (!existing) throw new ApiError(404, 'Pharmacy not found');
    return await pharmacyRepo.getPharmacyHoursAndHolidays(id);
};

export const updatePharmacyHours = async (id: string, body: any, actor: Actor) => {
    await assertCanEditPharmacy(id, actor);
    try {
        return await pharmacyRepo.replacePharmacyHoursWithAudit(id, body.hours, actor);
    } catch (error: any) {
        console.error('Update pharmacy hours error:', error);
        throw new ApiError(500, 'Failed to update pharmacy hours');
    }
};

export const addPharmacyHoliday = async (id: string, body: any, actor: Actor) => {
    await assertCanEditPharmacy(id, actor);
    const dateObj = new Date(`${body.holidayDate}T00:00:00.000Z`);
    if (Number.isNaN(dateObj.getTime())) throw new ApiError(400, 'Invalid holidayDate');
    const reason = body.reason ? String(body.reason).trim() : null;
    try {
        return await pharmacyRepo.createPharmacyHolidayWithAudit(id, dateObj, reason, actor);
    } catch (error: any) {
        if (error?.code === 'P2002') throw new ApiError(409, 'Holiday already exists for this date');
        console.error('Add pharmacy holiday error:', error);
        throw new ApiError(500, 'Failed to add holiday');
    }
};

export const removePharmacyHoliday = async (id: string, holidayId: string, actor: Actor) => {
    await assertCanEditPharmacy(id, actor);
    const holiday = await pharmacyRepo.findPharmacyHoliday(id, holidayId);
    if (!holiday) throw new ApiError(404, 'Holiday not found');
    try {
        await pharmacyRepo.deletePharmacyHolidayWithAudit(id, holiday, actor);
        return { deleted: true };
    } catch (error: any) {
        console.error('Remove pharmacy holiday error:', error);
        throw new ApiError(500, 'Failed to remove holiday');
    }
};

// ---------------- Step 3G: Pharmacy Receptionist ----------------

export const addReceptionist = async (pharmacyId: string, body: any, actor: Actor) => {
    await assertCanEditPharmacy(pharmacyId, actor);

    const phone = String(body.phone).trim();
    const email = body.email ? String(body.email).trim().toLowerCase() : null;

    const role = await pharmacyRepo.findRoleByName('RECEPTIONIST');
    if (!role) throw new ApiError(500, 'RECEPTIONIST role not found in database');

    if (await pharmacyRepo.findUserByPhoneOrOptionalEmail(phone, email)) {
        throw new ApiError(409, 'A user with this phone or email already exists');
    }

    const passwordHash = await bcrypt.hash(body.password, 10);

    try {
        return await pharmacyRepo.createReceptionistWithAudit(
            pharmacyId,
            {
                fullName: String(body.fullName).trim(),
                phone,
                email,
                passwordHash,
                roleId: role.id,
            },
            actor
        );
    } catch (error: any) {
        if (error?.code === 'P2002') throw new ApiError(409, 'A user with this phone or email already exists');
        console.error('Create receptionist error:', error);
        throw new ApiError(500, 'Failed to create receptionist');
    }
};

export const fetchReceptionists = async (pharmacyId: string, actor: Actor) => {
    await assertCanEditPharmacy(pharmacyId, actor);
    return await pharmacyRepo.listPharmacyReceptionists(pharmacyId);
};

export const setReceptionistStatus = async (pharmacyId: string, staffId: string, isActive: boolean, actor: Actor) => {
    await assertCanEditPharmacy(pharmacyId, actor);
    const staff = await pharmacyRepo.findReceptionistStaff(pharmacyId, staffId);
    if (!staff) throw new ApiError(404, 'Receptionist not found for this pharmacy');
    try {
        return await pharmacyRepo.updateReceptionistStatusWithAudit(staff, isActive, actor);
    } catch (error: any) {
        console.error('Update receptionist status error:', error);
        throw new ApiError(500, 'Failed to update receptionist status');
    }
};