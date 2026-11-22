import { RoleName } from '@prisma/client';
import { prisma } from '../../config/prisma';

type Actor = { id: string; role: RoleName };

export const findRoleByName = (name: RoleName) => prisma.role.findUnique({ where: { name } });

export const findUserByPhoneOrEmail = (phone: string, email: string) =>
    prisma.user.findFirst({ where: { OR: [{ phone }, { email }] }, select: { id: true } });

export const createRiderTx = (userData: any, profileData: any, actor: Actor) =>
    prisma.$transaction(
        async (tx) => {
            const user = await tx.user.create({
                data: userData,
                select: { id: true, fullName: true, phone: true, email: true, status: true },
            });

            const profile = await tx.riderProfile.create({
                data: {
                    userId: user.id,
                    ...profileData,
                    kycStatus: 'APPROVED',
                    status: 'AVAILABLE',
                },
            });

            // Initialize rider wallet immediately
            await tx.wallet.create({
                data: {
                    ownerKey: `RIDER:${user.id}`,
                    ownerType: 'RIDER',
                    userId: user.id,
                    balancePaise: BigInt(0),
                    heldPaise: BigInt(0),
                },
            });

            await tx.auditLog.create({
                data: {
                    actorId: actor.id,
                    actorRole: actor.role,
                    action: 'RIDER_CREATED',
                    entityType: 'RiderProfile',
                    entityId: profile.id,
                    after: { userId: user.id, phone: user.phone, email: user.email } as any,
                },
            });

            return { user, profile };
        },
        { maxWait: 10000, timeout: 30000 }
    );

export const listRiders = () =>
    prisma.riderProfile.findMany({
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, fullName: true, phone: true, email: true, status: true } } },
    });

export const findRiderByUserId = (userId: string) =>
    prisma.riderProfile.findUnique({ where: { userId } });

export const updateRiderStatusTx = (userId: string, before: any, data: any, actor: Actor) =>
    prisma.$transaction(async (tx) => {
        const updated = await tx.riderProfile.update({ where: { userId }, data });
        await tx.auditLog.create({
            data: {
                actorId: actor.id,
                actorRole: actor.role,
                action: 'RIDER_STATUS_UPDATED',
                entityType: 'RiderProfile',
                entityId: updated.id,
                before: { status: before.status, kycStatus: before.kycStatus } as any,
                after: { status: updated.status, kycStatus: updated.kycStatus } as any,
            },
        });
        return updated;
    });
