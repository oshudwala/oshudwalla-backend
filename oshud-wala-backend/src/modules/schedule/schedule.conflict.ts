import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/apiError';

const fmtMin = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const getWeekOfMonth = (d: Date) => Math.ceil(d.getUTCDate() / 7);

export const assertNoDoctorTimingConflict = async (
    doctorId: string,
    incoming: {
        recurrenceType: string;
        dayOfWeek: number;
        weekOfMonth?: number | null;
        specificDate?: Date | null;
        startMinute: number;
        endMinute: number;
        validFrom: Date;
        validTo?: Date | null;
    }
) => {
    const existingSchedules = await prisma.doctorSchedule.findMany({
        where: { isActive: true, pharmacyDoctor: { doctorId, isActive: true } },
        include: { pharmacyDoctor: { include: { pharmacy: { select: { name: true } } } } },
    });

    for (const s of existingSchedules) {
        // 1. Validity date-range overlap check
        const startsBeforeExistingEnds = !s.validTo || incoming.validFrom <= s.validTo;
        const existingStartsBeforeIncomingEnds = !incoming.validTo || s.validFrom <= incoming.validTo;
        if (!startsBeforeExistingEnds || !existingStartsBeforeIncomingEnds) continue;

        // 2. Time-window overlap check
        const timeOverlap = incoming.startMinute < s.endMinute && s.startMinute < incoming.endMinute;
        if (!timeOverlap) continue;

        // 3. Recurrence day clash check
        let dayClash = false;
        if (incoming.recurrenceType === 'DAILY' || s.recurrenceType === 'DAILY') {
            dayClash = true;
        } else if (incoming.recurrenceType === 'SPECIFIC_DATE' && s.recurrenceType === 'SPECIFIC_DATE') {
            dayClash = incoming.specificDate?.toISOString().slice(0, 10) === s.specificDate?.toISOString().slice(0, 10);
        } else if (incoming.recurrenceType === 'SPECIFIC_DATE' && s.recurrenceType === 'MONTHLY_WEEK_DAY') {
            dayClash =
                incoming.specificDate != null &&
                incoming.specificDate.getUTCDay() === s.dayOfWeek &&
                getWeekOfMonth(incoming.specificDate) === s.weekOfMonth;
        } else if (incoming.recurrenceType === 'MONTHLY_WEEK_DAY' && s.recurrenceType === 'SPECIFIC_DATE') {
            dayClash =
                s.specificDate != null &&
                s.specificDate.getUTCDay() === incoming.dayOfWeek &&
                getWeekOfMonth(s.specificDate) === incoming.weekOfMonth;
        } else if (incoming.recurrenceType === 'MONTHLY_WEEK_DAY' && s.recurrenceType === 'MONTHLY_WEEK_DAY') {
            dayClash = incoming.dayOfWeek === s.dayOfWeek && incoming.weekOfMonth === s.weekOfMonth;
        } else {
            dayClash = incoming.dayOfWeek === s.dayOfWeek;
        }

        if (dayClash) {
            throw new ApiError(
                409,
                `Timing conflict! Doctor already has a schedule at "${s.pharmacyDoctor.pharmacy.name}" (${fmtMin(s.startMinute)} - ${fmtMin(s.endMinute)})`
            );
        }
    }
};
