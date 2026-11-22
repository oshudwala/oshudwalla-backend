import { PrescriptionStatus, RoleName } from '@prisma/client';
import { ApiError } from '../../utils/apiError';
import * as repo from './prescription.repository';
import { PRESCRIPTION_CLEANUP_DELAY_MS, schedulePrescriptionImageCleanup } from './prescription.cleanup';

type Actor = { id: string; role: RoleName };

export const submitPrescription = async (body: any, actor: Actor) => {
    let targetPharmacyId: string;

    if (body.pharmacyId) {
        const ph = await repo.findPharmacyById(body.pharmacyId);
        if (!ph || ph.status !== 'ACTIVE') throw new ApiError(404, 'Active pharmacy not found');
        if (!ph.hasMedicineService) {
            throw new ApiError(400, 'This clinic does not have online pharmacy/prescription service enabled');
        }
        targetPharmacyId = ph.id;
    } else {
        const primary = await repo.findPrimaryMedicinePharmacy();
        if (!primary) throw new ApiError(400, 'No active Primary Pharmacy with medicine service configured');
        targetPharmacyId = primary.id;
    }

    const expiresAt = new Date(Date.now() + PRESCRIPTION_CLEANUP_DELAY_MS);
    const created = await repo.createPrescriptionTx(
        actor.id,
        targetPharmacyId,
        body.doctorName ? String(body.doctorName).trim() : null,
        body.patientNote ? String(body.patientNote).trim() : null,
        body.files,
        expiresAt,
        actor
    );

    // Schedule Cloudinary photo auto-deletion after 48 hours (2 days)
    await schedulePrescriptionImageCleanup(
        created.id,
        body.files.map((f: any) => f.storageKey)
    );

    return created;
};

export const getMyPrescriptions = async (patientId: string) => {
    return await repo.listPatientPrescriptions(patientId);
};

export const getPharmacyPrescriptions = async (pharmacyId: string, actor: Actor) => {
    if (actor.role !== 'SUPER_ADMIN') {
        const link = await repo.findActiveOwnerLink(actor.id, pharmacyId);
        if (!link) throw new ApiError(403, 'You can only view prescriptions for your own pharmacy');
    }
    return await repo.listPharmacyPrescriptions(pharmacyId);
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
