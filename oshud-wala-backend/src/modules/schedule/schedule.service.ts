import { RoleName, SlotStatus } from '@prisma/client';
import { ApiError } from '../../utils/apiError';
import * as repo from './schedule.repository';

type Actor = { id: string; role: RoleName };

const toUtcDate = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);
const dateKey = (d: Date): string => d.toISOString().slice(0, 10);

const assertCanManagePharmacyDoctor = async (pharmacyDoctorId: string, actor: Actor) => {
    const pd = await repo.findPharmacyDoctorWithContext(pharmacyDoctorId);
    if (!pd || !pd.isActive) throw new ApiError(404, 'Active doctor-pharmacy assignment not found');
    if (pd.pharmacy.status !== 'ACTIVE') throw new ApiError(400, 'Pharmacy is not ACTIVE');

    if (actor.role === 'SUPER_ADMIN') return pd;

    if (actor.role === 'PHARMACY') {
        const ownerLink = await repo.findActiveOwnerLink(actor.id, pd.pharmacyId);
        if (!ownerLink) throw new ApiError(403, 'You can only manage schedules for your own pharmacy');
        return pd;
    }

    if (actor.role === 'DOCTOR') {
        if (pd.doctor.userId !== actor.id) throw new ApiError(403, 'You can only manage your own schedule');
        return pd;
    }

    throw new ApiError(403, 'Forbidden');
};

export const createSchedule = async (body: any, actor: Actor) => {
    await assertCanManagePharmacyDoctor(body.pharmacyDoctorId, actor);

    const validFrom = toUtcDate(body.validFrom);
    const validTo = body.validTo ? toUtcDate(body.validTo) : null;
    if (validTo && validTo < validFrom) {
        throw new ApiError(400, 'validTo must be on or after validFrom');
    }

    return await repo.createScheduleWithAudit(
        {
            pharmacyDoctorId: body.pharmacyDoctorId,
            dayOfWeek: body.dayOfWeek,
            startMinute: body.startMinute,
            endMinute: body.endMinute,
            slotDurationMinutes: body.slotDurationMinutes,
            slotCapacity: body.slotCapacity ?? 1,
            validFrom,
            validTo,
            isActive: true,
        },
        actor
    );
};

export const fetchSchedules = async (pharmacyDoctorId: string) => {
    const pd = await repo.findPharmacyDoctorWithContext(pharmacyDoctorId);
    if (!pd) throw new ApiError(404, 'Doctor-pharmacy assignment not found');
    return await repo.getSchedulesAndExceptions(pharmacyDoctorId);
};

export const saveException = async (body: any, actor: Actor) => {
    await assertCanManagePharmacyDoctor(body.pharmacyDoctorId, actor);
    const exceptionDate = toUtcDate(body.exceptionDate);
    return await repo.upsertExceptionWithAudit(
        body.pharmacyDoctorId,
        exceptionDate,
        {
            type: body.type,
            startMinute: body.type === 'LEAVE' ? null : body.startMinute,
            endMinute: body.type === 'LEAVE' ? null : body.endMinute,
            reason: body.reason ? String(body.reason).trim() : null,
        },
        actor
    );
};

export const generateSlots = async (body: any, actor: Actor) => {
    const pd = await assertCanManagePharmacyDoctor(body.pharmacyDoctorId, actor);
    const fromDate = toUtcDate(body.fromDate);
    const toDate = toUtcDate(body.toDate);

    const diffDays = Math.floor((toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    if (diffDays > 31) {
        throw new ApiError(400, 'Cannot generate slots for more than 31 days at a time');
    }

    const { schedules, exceptions, holidays } = await repo.getGenerationInputs(pd.id, pd.pharmacyId, fromDate, toDate);
    const holidaySet = new Set(holidays.map((h) => dateKey(h.holidayDate)));
    const exceptionMap = new Map(exceptions.map((e) => [dateKey(e.exceptionDate), e]));

    const slotsToCreate: any[] = [];

    for (let i = 0; i < diffDays; i++) {
        const current = new Date(fromDate.getTime() + i * 24 * 60 * 60 * 1000);
        const key = dateKey(current);

        if (holidaySet.has(key)) continue;

        const exc = exceptionMap.get(key);
        if (exc && exc.type === 'LEAVE') continue;

        const dow = current.getUTCDay();
        const daySchedules = schedules.filter(
            (s) => s.dayOfWeek === dow && s.validFrom <= current && (!s.validTo || s.validTo >= current)
        );
        if (daySchedules.length === 0) continue;

        if (exc && exc.type === 'MODIFIED_HOURS' && exc.startMinute != null && exc.endMinute != null) {
            const base = daySchedules[0];
            for (let m = exc.startMinute; m + base.slotDurationMinutes <= exc.endMinute; m += base.slotDurationMinutes) {
                slotsToCreate.push({
                    pharmacyDoctorId: pd.id,
                    slotDate: current,
                    startMinute: m,
                    endMinute: m + base.slotDurationMinutes,
                    capacity: base.slotCapacity,
                    bookedCount: 0,
                    status: 'OPEN',
                });
            }
            continue;
        }

        for (const s of daySchedules) {
            for (let m = s.startMinute; m + s.slotDurationMinutes <= s.endMinute; m += s.slotDurationMinutes) {
                slotsToCreate.push({
                    pharmacyDoctorId: pd.id,
                    slotDate: current,
                    startMinute: m,
                    endMinute: m + s.slotDurationMinutes,
                    capacity: s.slotCapacity,
                    bookedCount: 0,
                    status: 'OPEN',
                });
            }
        }
    }

    const createdCount = await repo.bulkCreateSlotsWithAudit(pd.id, slotsToCreate, actor);
    return { createdCount, attemptedCount: slotsToCreate.length, fromDate: body.fromDate, toDate: body.toDate };
};

export const fetchSlots = async (pharmacyDoctorId: string, query: any) => {
    const whereDate: any = {};
    if (query.date) {
        whereDate.slotDate = toUtcDate(query.date);
    } else if (query.fromDate || query.toDate) {
        whereDate.slotDate = {};
        if (query.fromDate) whereDate.slotDate.gte = toUtcDate(query.fromDate);
        if (query.toDate) whereDate.slotDate.lte = toUtcDate(query.toDate);
    }
    return await repo.listSlots(pharmacyDoctorId, whereDate);
};

export const setSlotStatus = async (slotId: string, status: SlotStatus, actor: Actor) => {
    const slot = await repo.findSlotWithContext(slotId);
    if (!slot) throw new ApiError(404, 'Appointment slot not found');
    await assertCanManagePharmacyDoctor(slot.pharmacyDoctorId, actor);
    return await repo.updateSlotStatusWithAudit(slot, status, actor);
};
