import { PrescriptionStatus, RoleName } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/apiError';
import * as repo from './prescription.repository';
import { PRESCRIPTION_CLEANUP_DELAY_MS, schedulePrescriptionImageCleanup } from './prescription.cleanup';

type Actor = { id: string; role: RoleName };

export const submitPrescription = async (body: any, actor: Actor) => {
    // If pharmacyId is explicitly passed and active, use it; otherwise route automatically to Primary Pharmacy
    let targetPharmacyId = body.pharmacyId || null;
    if (targetPharmacyId) {
        const ph = await repo.findPharmacyById(targetPharmacyId);
        if (!ph || ph.status !== 'ACTIVE') targetPharmacyId = null;
    }
    if (!targetPharmacyId) {
        const primary = await repo.findPrimaryMedicinePharmacy();
        if (!primary) throw new ApiError(400, 'No active Primary Pharmacy configured');
        targetPharmacyId = primary.id;
    }

    const expiresAt = new Date(Date.now() + PRESCRIPTION_CLEANUP_DELAY_MS);
    const created = await repo.createPrescriptionTx(
        actor.id,
        targetPharmacyId,
        body.doctorName ? String(body.doctorName).trim() : null,
        body.patientNote ? String(body.patientNote).trim() : (body.notes ? String(body.notes).trim() : null),
        body.files,
        expiresAt,
        actor
    );

    // Schedule Cloudinary photo auto-deletion after 48 hours (2 days)
    await schedulePrescriptionImageCleanup(
        created.id,
        body.files.map((f: any) => f.storageKey)
    );

    // Create in-app notification for pharmacy staff
    try {
        const staff = await prisma.pharmacyStaff.findMany({
            where: { pharmacyId: targetPharmacyId, isActive: true },
            select: { userId: true },
        });
        for (const s of staff) {
            await prisma.notification.create({
                data: {
                    userId: s.userId,
                    category: 'PRESCRIPTION',
                    eventType: 'PRESCRIPTION_SUBMITTED',
                    title: `New Prescription Awaiting Audit (#${created.prescriptionNumber})`,
                    body: `Patient submitted prescription #${created.prescriptionNumber} for pharmacist audit & verification.`,
                    data: { prescriptionId: created.id, prescriptionNumber: created.prescriptionNumber, link: '/pharmacy/prescriptions' },
                    priority: 'HIGH',
                    dedupeKey: `rx_sub_${created.id}_${s.userId}`,
                },
            }).catch(() => {});
        }
    } catch (e) {}

    return created;
};

export const getMyPrescriptions = async (patientId: string) => {
    return await repo.listPatientPrescriptions(patientId);
};

export const getPharmacyPrescriptions = async (pharmacyId: string, actor: Actor) => {
    const primary = await repo.findPrimaryMedicinePharmacy();
    if (primary && primary.id !== pharmacyId && actor.role !== 'SUPER_ADMIN') {
        // Prescriptions route exclusively to the primary pharmacy
        return [];
    }
    if (actor.role !== 'SUPER_ADMIN') {
        const link = await repo.findActiveOwnerLink(actor.id, pharmacyId);
        if (!link) throw new ApiError(403, 'You can only view prescriptions for your own pharmacy');
    }
    return await repo.listPharmacyPrescriptions(pharmacyId);
};

export const getPharmacyPrescriptionsForCurrentUser = async (actor: Actor) => {
    const primary = await repo.findPrimaryMedicinePharmacy();

    if (actor.role === 'SUPER_ADMIN') {
        return await repo.listAllPrescriptions();
    }

    // Role is PHARMACY: Check which pharmacy this user is linked to
    const staff = await repo.findStaffPharmacyByUserId(actor.id);
    const pharmacyId = staff?.pharmacyId;

    if (pharmacyId) {
        return await repo.listPharmacyPrescriptions(pharmacyId);
    }

    // Fallback: if staff link wasn't explicit, but primary pharmacy exists, return primary
    if (primary) {
        return await repo.listPharmacyPrescriptions(primary.id);
    }

    return [];
};

export const reviewPrescription = async (
    id: string,
    status: PrescriptionStatus,
    rejectionReason: string | null | undefined,
    actor: Actor
) => {
    const existing = await repo.findPrescriptionById(id);
    if (!existing) throw new ApiError(404, 'Prescription not found');

    if (actor.role !== 'SUPER_ADMIN') {
        if (!existing.pharmacyId) throw new ApiError(403, 'Forbidden');
        const link = await repo.findActiveOwnerLink(actor.id, existing.pharmacyId);
        if (!link) throw new ApiError(403, 'You can only review prescriptions for your own pharmacy');
    }

    if (existing.status === 'VERIFIED' || existing.status === 'REJECTED' || existing.status === 'CANCELLED') {
        throw new ApiError(400, `Prescription is already ${existing.status}`);
    }

    return await repo.reviewPrescriptionTx(existing, status, rejectionReason ? String(rejectionReason).trim() : null, actor);
};
