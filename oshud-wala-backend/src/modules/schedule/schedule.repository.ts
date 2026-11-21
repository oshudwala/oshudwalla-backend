import { RoleName, SlotStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';

type Actor = { id: string; role: RoleName };

export const findPharmacyDoctorWithContext = (id: string) =>
    prisma.pharmacyDoctor.findUnique({
        where: { id },
        include: {
            pharmacy: { select: { id: true, status: true } },
            doctor: { select: { id: true, userId: true } },
        },
    });

export const findActiveOwnerLink = (userId: string, pharmacyId: string) =>
    prisma.pharmacyStaff.findFirst({
        where: { userId, pharmacyId, staffRole: 'OWNER', isActive: true },
    });

export const createScheduleWithAudit = (data: any, actor: Actor) =>
    prisma.$transaction(
        async (tx) => {
            const schedule = await tx.doctorSchedule.create({ data });
            await tx.auditLog.create({
                data: {
                    actorId: actor.id,
                    actorRole: actor.role,
                    action: 'DOCTOR_SCHEDULE_CREATED',
                    entityType: 'DoctorSchedule',
                    entityId: schedule.id,
                    after: schedule as any,
                },
            });
            return schedule;
        },
        { maxWait: 10000, timeout: 30000 }
    );

export const getSchedulesAndExceptions = async (pharmacyDoctorId: string) => {
    const [schedules, exceptions] = await prisma.$transaction([
        prisma.doctorSchedule.findMany({
            where: { pharmacyDoctorId, isActive: true },
            orderBy: [{ dayOfWeek: 'asc' }, { startMinute: 'asc' }],
        }),
        prisma.scheduleException.findMany({
            where: { pharmacyDoctorId },
            orderBy: { exceptionDate: 'asc' },
        }),
    ]);
    return { schedules, exceptions };
};

export const upsertExceptionWithAudit = (pharmacyDoctorId: string, exceptionDate: Date, data: any, actor: Actor) =>
    prisma.$transaction(
        async (tx) => {
            const exception = await tx.scheduleException.upsert({
                where: { pharmacyDoctorId_exceptionDate: { pharmacyDoctorId, exceptionDate } },
                create: { pharmacyDoctorId, exceptionDate, ...data },
                update: data,
            });
            await tx.auditLog.create({
                data: {
                    actorId: actor.id,
                    actorRole: actor.role,
                    action: 'SCHEDULE_EXCEPTION_SAVED',
                    entityType: 'ScheduleException',
                    entityId: exception.id,
                    after: exception as any,
                },
            });
            return exception;
        },
        { maxWait: 10000, timeout: 30000 }
    );

export const getGenerationInputs = async (pharmacyDoctorId: string, pharmacyId: string, fromDate: Date, toDate: Date) => {
    const [schedules, exceptions, holidays] = await prisma.$transaction([
        prisma.doctorSchedule.findMany({
            where: { pharmacyDoctorId, isActive: true },
        }),
        prisma.scheduleException.findMany({
            where: { pharmacyDoctorId, exceptionDate: { gte: fromDate, lte: toDate } },
        }),
        prisma.pharmacyHoliday.findMany({
            where: { pharmacyId, holidayDate: { gte: fromDate, lte: toDate } },
        }),
    ]);
    return { schedules, exceptions, holidays };
};

export const bulkCreateSlotsWithAudit = (pharmacyDoctorId: string, slots: any[], actor: Actor) =>
    prisma.$transaction(
        async (tx) => {
            const result = slots.length > 0
                ? await tx.appointmentSlot.createMany({ data: slots, skipDuplicates: true })
                : { count: 0 };

            await tx.auditLog.create({
                data: {
                    actorId: actor.id,
                    actorRole: actor.role,
                    action: 'APPOINTMENT_SLOTS_GENERATED',
                    entityType: 'PharmacyDoctor',
                    entityId: pharmacyDoctorId,
                    after: { createdCount: result.count, attemptedCount: slots.length } as any,
                },
            });
            return result.count;
        },
        { maxWait: 10000, timeout: 30000 }
    );

export const listSlots = (pharmacyDoctorId: string, whereDate: any) =>
    prisma.appointmentSlot.findMany({
        where: { pharmacyDoctorId, ...whereDate },
        orderBy: [{ slotDate: 'asc' }, { startMinute: 'asc' }],
    });

export const findSlotWithContext = (slotId: string) =>
    prisma.appointmentSlot.findUnique({
        where: { id: slotId },
        include: {
            pharmacyDoctor: {
                include: {
                    doctor: { select: { id: true, userId: true } },
                },
            },
        },
    });

export const updateSlotStatusWithAudit = (slot: any, status: SlotStatus, actor: Actor) =>
    prisma.$transaction(
        async (tx) => {
            const updated = await tx.appointmentSlot.update({
                where: { id: slot.id },
                data: { status },
            });
            await tx.auditLog.create({
                data: {
                    actorId: actor.id,
                    actorRole: actor.role,
                    action: 'APPOINTMENT_SLOT_STATUS_UPDATED',
                    entityType: 'AppointmentSlot',
                    entityId: slot.id,
                    before: { status: slot.status } as any,
                    after: { status: updated.status } as any,
                },
            });
            return updated;
        },
        { maxWait: 10000, timeout: 30000 }
    );
