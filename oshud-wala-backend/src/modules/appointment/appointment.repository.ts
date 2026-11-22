import crypto from 'crypto';
import { AppointmentStatus, QueueStatus, RoleName } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/apiError';

type Actor = { id: string; role: RoleName };

export const findPharmacyDoctorContext = (pharmacyDoctorId: string) =>
    prisma.pharmacyDoctor.findUnique({
        where: { id: pharmacyDoctorId },
        include: {
            doctor: { select: { id: true, userId: true, fullName: true } },
            pharmacy: { select: { id: true, name: true, status: true } },
        },
    });

export const findActiveStaffLink = (userId: string, pharmacyId: string) =>
    prisma.pharmacyStaff.findFirst({
        where: { userId, pharmacyId, isActive: true },
    });

export const findAppointmentById = (id: string) =>
    prisma.appointment.findUnique({
        where: { id },
        include: {
            slot: true,
            pharmacyDoctor: {
                include: {
                    doctor: { select: { id: true, userId: true, fullName: true } },
                    pharmacy: { select: { id: true, name: true } },
                },
            },
        },
    });

export const bookAppointmentTx = (
    patientId: string,
    slotId: string,
    reason: string | null,
    idempotencyKey: string | null,
    actor: Actor
) =>
    prisma.$transaction(
        async (tx) => {
            if (idempotencyKey) {
                const existing = await tx.appointment.findUnique({
                    where: { patientId_idempotencyKey: { patientId, idempotencyKey } },
                });
                if (existing) return existing;
            }

            // Lock the slot row to prevent concurrent overbooking
            const lockedSlots = await tx.$queryRaw<
                Array<{ id: string; pharmacyDoctorId: string; slotDate: Date; capacity: number; bookedCount: number; status: string }>
            >`SELECT id, "pharmacyDoctorId", "slotDate", capacity, "bookedCount", status FROM appointment_slots WHERE id = ${slotId}::uuid FOR UPDATE`;

            const slot = lockedSlots[0];
            if (!slot) throw new ApiError(404, 'Appointment slot not found');
            if (slot.status !== 'OPEN') throw new ApiError(400, 'This slot is blocked and not open for booking');
            if (slot.bookedCount >= slot.capacity) throw new ApiError(409, 'This slot is already full');

            const pd = await tx.pharmacyDoctor.findUnique({
                where: { id: slot.pharmacyDoctorId },
                include: { pharmacy: { select: { status: true } } },
            });
            if (!pd || !pd.isActive || pd.pharmacy.status !== 'ACTIVE') {
                throw new ApiError(400, 'Doctor or pharmacy is not active');
            }

            // Increment slot bookedCount
            await tx.appointmentSlot.update({
                where: { id: slot.id },
                data: { bookedCount: { increment: 1 } },
            });

            // Atomically issue next token number for (pharmacyDoctorId, slotDate)
            const queueDay = await tx.queueDay.upsert({
                where: {
                    pharmacyDoctorId_queueDate: {
                        pharmacyDoctorId: slot.pharmacyDoctorId,
                        queueDate: slot.slotDate,
                    },
                },
                create: {
                    pharmacyDoctorId: slot.pharmacyDoctorId,
                    queueDate: slot.slotDate,
                    lastTokenIssued: 1,
                    status: 'OPEN',
                },
                update: {
                    lastTokenIssued: { increment: 1 },
                },
            });

            const appointmentNumber = `APT-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

            const appointment = await tx.appointment.create({
                data: {
                    appointmentNumber,
                    patientId,
                    pharmacyDoctorId: slot.pharmacyDoctorId,
                    slotId: slot.id,
                    appointmentDate: slot.slotDate,
                    tokenNumber: queueDay.lastTokenIssued,
                    status: 'BOOKED',
                    feePaise: pd.consultationFeePaise,
                    reason,
                    idempotencyKey,
                },
                include: {
                    slot: { select: { id: true, slotDate: true, startMinute: true, endMinute: true } },
                },
            });

            await tx.auditLog.create({
                data: {
                    actorId: actor.id,
                    actorRole: actor.role,
                    action: 'APPOINTMENT_BOOKED',
                    entityType: 'Appointment',
                    entityId: appointment.id,
                    after: appointment as any,
                },
            });

            return appointment;
        },
        { maxWait: 10000, timeout: 30000 }
    );

export const listPatientAppointments = (patientId: string) =>
    prisma.appointment.findMany({
        where: { patientId },
        orderBy: { bookedAt: 'desc' },
        include: {
            slot: { select: { id: true, slotDate: true, startMinute: true, endMinute: true } },
            pharmacyDoctor: {
                select: {
                    id: true,
                    doctor: { select: { id: true, fullName: true } },
                    pharmacy: { select: { id: true, name: true, city: true } },
                },
            },
        },
    });

export const listPharmacyDoctorAppointments = (pharmacyDoctorId: string, appointmentDate?: Date) =>
    prisma.appointment.findMany({
        where: {
            pharmacyDoctorId,
            ...(appointmentDate ? { appointmentDate } : {}),
        },
        orderBy: [{ appointmentDate: 'asc' }, { tokenNumber: 'asc' }],
        include: {
            patient: { select: { id: true, fullName: true, phone: true } },
            slot: { select: { id: true, startMinute: true, endMinute: true } },
        },
    });

export const cancelAppointmentTx = (appointment: any, cancelReason: string | null, actor: Actor) =>
    prisma.$transaction(
        async (tx) => {
            const updated = await tx.appointment.update({
                where: { id: appointment.id },
                data: {
                    status: 'CANCELLED',
                    cancelledAt: new Date(),
                    cancelReason,
                },
            });

            await tx.appointmentSlot.update({
                where: { id: appointment.slotId },
                data: { bookedCount: { decrement: 1 } },
            });

            await tx.auditLog.create({
                data: {
                    actorId: actor.id,
                    actorRole: actor.role,
                    action: 'APPOINTMENT_CANCELLED',
                    entityType: 'Appointment',
                    entityId: appointment.id,
                    before: { status: appointment.status } as any,
                    after: { status: updated.status, cancelReason } as any,
                },
            });

            return updated;
        },
        { maxWait: 10000, timeout: 30000 }
    );

export const updateAppointmentStatusTx = (
    appointment: any,
    status: AppointmentStatus,
    doctorNotes: string | undefined,
    actor: Actor
) =>
    prisma.$transaction(
        async (tx) => {
            const now = new Date();
            const data: any = { status };
            if (status === 'CHECKED_IN') data.checkedInAt = now;
            if (status === 'IN_CONSULTATION') data.startedAt = now;
            if (status === 'COMPLETED') data.completedAt = now;
            if (doctorNotes !== undefined) data.doctorNotes = doctorNotes;

            const updated = await tx.appointment.update({
                where: { id: appointment.id },
                data,
            });

            if (status === 'IN_CONSULTATION') {
                await tx.queueDay.upsert({
                    where: {
                        pharmacyDoctorId_queueDate: {
                            pharmacyDoctorId: appointment.pharmacyDoctorId,
                            queueDate: appointment.appointmentDate,
                        },
                    },
                    create: {
                        pharmacyDoctorId: appointment.pharmacyDoctorId,
                        queueDate: appointment.appointmentDate,
                        lastTokenIssued: appointment.tokenNumber,
                        currentTokenNumber: appointment.tokenNumber,
                        status: 'OPEN',
                    },
                    update: {
                        currentTokenNumber: appointment.tokenNumber,
                    },
                });
            }

            await tx.auditLog.create({
                data: {
                    actorId: actor.id,
                    actorRole: actor.role,
                    action: 'APPOINTMENT_STATUS_UPDATED',
                    entityType: 'Appointment',
                    entityId: appointment.id,
                    before: { status: appointment.status } as any,
                    after: { status: updated.status } as any,
                },
            });

            return updated;
        },
        { maxWait: 10000, timeout: 30000 }
    );

export const getQueueForDate = async (pharmacyDoctorId: string, queueDate: Date) => {
    const [queueDay, appointments] = await prisma.$transaction([
        prisma.queueDay.findUnique({
            where: { pharmacyDoctorId_queueDate: { pharmacyDoctorId, queueDate } },
        }),
        prisma.appointment.findMany({
            where: {
                pharmacyDoctorId,
                appointmentDate: queueDate,
                status: { in: ['BOOKED', 'CHECKED_IN', 'IN_CONSULTATION', 'COMPLETED'] },
            },
            orderBy: { tokenNumber: 'asc' },
            select: {
                id: true,
                appointmentNumber: true,
                tokenNumber: true,
                status: true,
            },
        }),
    ]);

    return {
        queueDate: queueDate.toISOString().slice(0, 10),
        status: queueDay?.status ?? 'OPEN',
        currentTokenNumber: queueDay?.currentTokenNumber ?? null,
        lastTokenIssued: queueDay?.lastTokenIssued ?? 0,
        appointments,
    };
};

export const updateQueueStatusTx = (pharmacyDoctorId: string, queueDate: Date, status: QueueStatus, actor: Actor) =>
    prisma.$transaction(
        async (tx) => {
            const queueDay = await tx.queueDay.upsert({
                where: { pharmacyDoctorId_queueDate: { pharmacyDoctorId, queueDate } },
                create: { pharmacyDoctorId, queueDate, status },
                update: { status },
            });

            await tx.auditLog.create({
                data: {
                    actorId: actor.id,
                    actorRole: actor.role,
                    action: 'QUEUE_STATUS_UPDATED',
                    entityType: 'QueueDay',
                    entityId: queueDay.id,
                    after: { status: queueDay.status, queueDate } as any,
                },
            });

            return queueDay;
        },
        { maxWait: 10000, timeout: 30000 }
    );
