import { Router, Request, Response } from 'express';
import { prisma } from '../../config/prisma';
import { authenticate, authorizeRoles, AuthRequest } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { updateBookingRulesSchema } from './booking-rules.validation';

const router = Router();
const RULE_ID = 'default';

const getOrCreateRules = () =>
    prisma.appointmentBookingRule.upsert({
        where: { id: RULE_ID },
        create: { id: RULE_ID },
        update: {},
    });

router.get(
    '/',
    asyncHandler(async (_req: Request, res: Response) => {
        const rules = await getOrCreateRules();
        res.status(200).json(new ApiResponse(200, rules, 'Appointment booking rules fetched'));
    })
);

router.put(
    '/',
    authenticate,
    authorizeRoles('SUPER_ADMIN'),
    validate(updateBookingRulesSchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const before = await getOrCreateRules();

        const updated = await prisma.$transaction(async (tx) => {
            const rule = await tx.appointmentBookingRule.upsert({
                where: { id: RULE_ID },
                create: { id: RULE_ID, ...req.body, updatedById: req.user!.userId },
                update: { ...req.body, updatedById: req.user!.userId },
            });

            await tx.auditLog.create({
                data: {
                    actorId: req.user!.userId,
                    actorRole: req.user!.role as any,
                    action: 'BOOKING_RULES_UPDATED',
                    entityType: 'AppointmentBookingRule',
                    entityId: RULE_ID,
                    before: before as any,
                    after: rule as any,
                },
            });

            return rule;
        });

        res.status(200).json(new ApiResponse(200, updated, 'Appointment booking rules updated'));
    })
);

export default router;
