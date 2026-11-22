import crypto from 'crypto';
import { PrescriptionStatus, RoleName } from '@prisma/client';
import { prisma } from '../../config/prisma';

type Actor = { id: string; role: RoleName };

export const findPharmacyById = (id: string) => prisma.pharmacy.findUnique({ where: { id } });

export const findPrimaryMedicinePharmacy = () =>
    prisma.pharmacy.findFirst({ where: { isPrimary: true, status: 'ACTIVE', hasMedicineService: true } });

export const findActiveOwnerLink = (userId: string, pharmacyId: string) =>
    prisma.pharmacyStaff.findFirst({ where: { userId, pharmacyId, staffRole: 'OWNER', isActive: true } });

export const findPrescriptionById = (id: string) =>
    prisma.prescription.findUnique({
        where: { id },
        include: { files: true, pharmacy: { select: { id: true, name: true } } },
    });

export const createPrescriptionTx = (
    patientId: string,
    pharmacyId: string,
    doctorName: string | null,
    patientNote: string | null,
    files: any[],
    expiresAt: Date,
    actor: Actor
) =>
    prisma.$transaction(
        async (tx) => {
            const prescriptionNumber = `RX-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
            const created = await tx.prescription.create({
                data: {
                    prescriptionNumber,
                    patientId,
                    pharmacyId,
                    status: 'SUBMITTED',
                    doctorName,
                    patientNote,
                    expiresAt,
                    files: { create: files },
                    history: {
                        create: {
                            fromStatus: null,
                            toStatus: 'SUBMITTED',
                            actorId: actor.id,
                        },
                    },
                },
                include: { files: true, pharmacy: { select: { id: true, name: true } } },
            });

            await tx.auditLog.create({
                data: {
                    actorId: actor.id,
                    actorRole: actor.role,
                    action: 'PRESCRIPTION_SUBMITTED',
                    entityType: 'Prescription',
                    entityId: created.id,
                    after: { prescriptionNumber: created.prescriptionNumber, pharmacyId, expiresAt } as any,
                },
            });

            return created;
        },
        { maxWait: 10000, timeout: 30000 }
    );

export const listPatientPrescriptions = (patientId: string) =>
    prisma.prescription.findMany({
        where: { patientId },
        orderBy: { createdAt: 'desc' },
        include: { files: true, pharmacy: { select: { id: true, name: true } } },
    });

export const listPharmacyPrescriptions = (pharmacyId: string) =>
    prisma.prescription.findMany({
        where: { pharmacyId },
        orderBy: { createdAt: 'desc' },
        include: {
            files: true,
            patient: { select: { id: true, fullName: true, phone: true } },
        },
    });

export const reviewPrescriptionTx = (
    prescription: any,
    status: PrescriptionStatus,
    rejectionReason: string | null,
    actor: Actor
) =>
    prisma.$transaction(
        async (tx) => {
            const updated = await tx.prescription.update({
                where: { id: prescription.id },
                data: {
                    status,
                    rejectionReason: status === 'REJECTED' ? rejectionReason : null,
                    verifiedById: actor.id,
                    verifiedAt: status === 'VERIFIED' ? new Date() : null,
                },
                include: { files: true },
            });

            await tx.prescriptionStatusHistory.create({
                data: {
                    prescriptionId: prescription.id,
                    fromStatus: prescription.status,
                    toStatus: status,
                    actorId: actor.id,
                    reason: rejectionReason,
                },
            });

            await tx.auditLog.create({
                data: {
                    actorId: actor.id,
                    actorRole: actor.role,
                    action: status === 'VERIFIED' ? 'PRESCRIPTION_VERIFIED' : 'PRESCRIPTION_REJECTED',
                    entityType: 'Prescription',
                    entityId: prescription.id,
                    before: { status: prescription.status } as any,
                    after: { status: updated.status, rejectionReason } as any,
                },
            });

            return updated;
        },
        { maxWait: 10000, timeout: 30000 }
    );
