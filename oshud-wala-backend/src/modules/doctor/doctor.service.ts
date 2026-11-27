import { RoleName } from '@prisma/client';
import { ApiError } from '../../utils/apiError';
import * as doctorRepo from './doctor.repository';
import { prisma } from '../../config/prisma';

type Actor = { id: string; role: RoleName };

export const addDoctor = async (pharmacyId: string, doctorData: any) => {
    try {
        return await doctorRepo.onboardDoctorToPharmacy(pharmacyId, doctorData);
    } catch (error: any) {
        if (error instanceof ApiError) throw error;
        console.error('Add Doctor Error:', error);
        throw new ApiError(500, 'Failed to onboard doctor');
    }
};

export const fetchPharmacyDoctors = async (pharmacyId: string) => {
    return await doctorRepo.getPharmacyDoctors(pharmacyId);
};

// ---------------- Step 4: Global Doctor Profile & PharmacyDoctor Assignment ----------------

export const fetchGlobalDoctors = async (q?: string, specializationId?: string) => {
    return await doctorRepo.listGlobalDoctors(q, specializationId);
};

export const fetchDoctorById = async (id: string) => {
    const doc = await doctorRepo.findDoctorById(id);
    if (!doc) throw new ApiError(404, 'Doctor not found');
    return doc;
};

export const createGlobalDoctor = async (body: any, actor: Actor) => {
    const uniqueSpecIds = Array.from(new Set<string>(body.specializationIds));
    const foundCount = await doctorRepo.countSpecializations(uniqueSpecIds);
    if (foundCount !== uniqueSpecIds.length) {
        throw new ApiError(404, 'One or more specializations not found');
    }

    const data = {
        fullName: String(body.fullName).trim(),
        phone: body.phone ? String(body.phone).trim() : null,
        email: body.email ? String(body.email).trim().toLowerCase() : null,
        registrationNumber: String(body.registrationNumber).trim(),
        qualifications: body.qualifications ? String(body.qualifications).trim() : null,
        experienceYears: body.experienceYears ?? null,
        bio: body.bio ? String(body.bio).trim() : null,
        languages: body.languages ?? [],
        isVerified: body.isVerified ?? false,
    };

    try {
        return await doctorRepo.createGlobalDoctorWithAudit(data, uniqueSpecIds, actor);
    } catch (error: any) {
        if (error?.code === 'P2002') {
            throw new ApiError(409, 'A doctor with this phone, email, or registrationNumber already exists');
        }
        console.error('Create global doctor error:', error);
        throw new ApiError(500, 'Failed to create doctor');
    }
};

export const updateGlobalDoctor = async (id: string, body: any, actor: Actor) => {
    const existing = await doctorRepo.findDoctorById(id);
    if (!existing) throw new ApiError(404, 'Doctor not found');

    let uniqueSpecIds: string[] | undefined;
    if (body.specializationIds !== undefined) {
        uniqueSpecIds = Array.from(new Set<string>(body.specializationIds));
        const foundCount = await doctorRepo.countSpecializations(uniqueSpecIds);
        if (foundCount !== uniqueSpecIds.length) {
            throw new ApiError(404, 'One or more specializations not found');
        }
    }

    const data: any = {};
    if (body.fullName !== undefined) data.fullName = String(body.fullName).trim();
    if (body.phone !== undefined) data.phone = body.phone ? String(body.phone).trim() : null;
    if (body.email !== undefined) data.email = body.email ? String(body.email).trim().toLowerCase() : null;
    if (body.registrationNumber !== undefined) data.registrationNumber = body.registrationNumber ? String(body.registrationNumber).trim() : null;
    if (body.qualifications !== undefined) data.qualifications = body.qualifications ? String(body.qualifications).trim() : null;
    if (body.experienceYears !== undefined) data.experienceYears = body.experienceYears;
    if (body.bio !== undefined) data.bio = body.bio ? String(body.bio).trim() : null;
    if (body.languages !== undefined) data.languages = body.languages;
    if (body.isVerified !== undefined) data.isVerified = body.isVerified;
    if (body.isFeatured !== undefined) data.isFeatured = body.isFeatured;

    // Check duplicate phone/email if changed
    if (data.phone && data.phone !== existing.phone) {
        const phoneConflict = await prisma.user.findFirst({
            where: { phone: data.phone, NOT: existing.userId ? { id: existing.userId } : undefined }
        });
        if (phoneConflict) throw new ApiError(409, "Phone number is already in use by another account");
    }
    if (data.email && data.email !== existing.email) {
        const emailConflict = await prisma.user.findFirst({
            where: { email: data.email, NOT: existing.userId ? { id: existing.userId } : undefined }
        });
        if (emailConflict) throw new ApiError(409, "Email address is already in use by another account");
    }

    try {
        return await doctorRepo.updateGlobalDoctorWithAudit(id, existing, data, uniqueSpecIds, actor);
    } catch (error: any) {
        if (error instanceof ApiError) throw error;
        console.error('Update global doctor error:', error);
        throw new ApiError(500, 'Failed to update doctor');
    }
};

export const assignDoctorToPharmacy = async (body: any, actor: Actor) => {
    const pharmacy = await doctorRepo.findPharmacyById(body.pharmacyId);
    if (!pharmacy) throw new ApiError(404, 'Pharmacy not found');
    if (pharmacy.status !== 'ACTIVE') throw new ApiError(400, 'Pharmacy is not ACTIVE');

    if (actor.role !== 'SUPER_ADMIN') {
        const link = await doctorRepo.findActiveOwnerLink(actor.id, body.pharmacyId);
        if (!link) throw new ApiError(403, 'You can only assign doctors to your own pharmacy');
    }

    const doctor = await doctorRepo.findDoctorById(body.doctorId);
    if (!doctor) throw new ApiError(404, 'Doctor not found');

    try {
        return await doctorRepo.upsertPharmacyDoctorWithAudit(body.pharmacyId, body.doctorId, body.consultationFeePaise ?? 0, actor);
    } catch (error: any) {
        console.error('Assign doctor error:', error);
        throw new ApiError(500, 'Failed to assign doctor to pharmacy');
    }
};

export const setAssignmentStatus = async (assignmentId: string, isActive: boolean, actor: Actor) => {
    const assignment = await doctorRepo.findAssignmentById(assignmentId);
    if (!assignment) throw new ApiError(404, 'Doctor assignment not found');

    if (actor.role !== 'SUPER_ADMIN') {
        const link = await doctorRepo.findActiveOwnerLink(actor.id, assignment.pharmacyId);
        if (!link) throw new ApiError(403, 'You can only manage doctor assignments for your own pharmacy');
    }

    try {
        return await doctorRepo.updateAssignmentStatusWithAudit(assignment, isActive, actor);
    } catch (error: any) {
        console.error('Update assignment status error:', error);
        throw new ApiError(500, 'Failed to update assignment status');
    }
};
