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

export const listRiders = async () => {
    const profiles = await prisma.riderProfile.findMany({
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, fullName: true, phone: true, email: true, status: true } } },
    });

    const existingUserIds = new Set(profiles.map((p) => p.userId));

    // Find any users with role RIDER who don't have a profile yet
    const orphanRiders = await prisma.user.findMany({
        where: {
            role: { name: 'RIDER' },
            status: 'ACTIVE',
            id: { notIn: Array.from(existingUserIds) },
        },
        select: { id: true, fullName: true, phone: true, email: true, status: true },
    });

    for (const u of orphanRiders) {
        try {
            const created = await prisma.riderProfile.create({
                data: {
                    userId: u.id,
                    kycStatus: 'APPROVED',
                    status: 'AVAILABLE',
                },
                include: { user: { select: { id: true, fullName: true, phone: true, email: true, status: true } } },
            });
            profiles.push(created);
        } catch {
            // ignore if race condition created it
        }
    }

    return profiles;
};

export const findRiderByUserId = (userId: string) =>
    prisma.riderProfile.findUnique({ where: { userId } });

export const findRiderByIdOrUserId = (id: string) =>
    prisma.riderProfile.findFirst({
        where: { OR: [{ id }, { userId: id }] },
        include: { user: { select: { id: true, fullName: true, phone: true, email: true, status: true } } },
    });

export const updateRiderTx = (
    riderId: string,
    profileData: any,
    userData: any,
    actor: Actor
) =>
    prisma.$transaction(async (tx) => {
        const existing = await tx.riderProfile.findFirst({
            where: { OR: [{ id: riderId }, { userId: riderId }] },
            include: { user: true },
        });
        if (!existing) throw new Error('Rider profile not found');

        const updatedProfile = await tx.riderProfile.update({
            where: { id: existing.id },
            data: profileData,
            include: { user: { select: { id: true, fullName: true, phone: true, email: true, status: true } } },
        });

        if (Object.keys(userData).length > 0) {
            await tx.user.update({
                where: { id: existing.userId },
                data: userData,
            });
        }

        await tx.auditLog.create({
            data: {
                actorId: actor.id,
                actorRole: actor.role,
                action: 'RIDER_PROFILE_UPDATED',
                entityType: 'RiderProfile',
                entityId: existing.id,
                before: { ...existing } as any,
                after: { ...updatedProfile, ...userData } as any,
            },
        });

        return tx.riderProfile.findUnique({
            where: { id: existing.id },
            include: { user: { select: { id: true, fullName: true, phone: true, email: true, status: true } } },
        });
    });

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
