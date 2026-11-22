import { RoleName } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/apiError';

type Actor = { id: string; role: RoleName };

export const getMyReferralAndCoins = async (userId: string) => {
    const [coinAccount, referrals] = await prisma.$transaction([
        prisma.coinAccount.upsert({
            where: { userId },
            create: { userId, balance: 0 },
            update: {},
            include: { entries: { orderBy: { createdAt: 'desc' }, take: 20 } },
        }),
        prisma.referral.findMany({
            where: { referrerId: userId },
            orderBy: { createdAt: 'desc' },
            include: { referredUser: { select: { id: true, fullName: true } } },
        }),
    ]);
    return { referralId: userId, coinAccount, referrals };
};

export const applyReferralTx = (referredUserId: string, referrerId: string) =>
    prisma.$transaction(async (tx) => {
        if (referredUserId === referrerId) {
            throw new ApiError(400, 'You cannot refer yourself');
        }
        const referrer = await tx.user.findUnique({ where: { id: referrerId }, select: { id: true, status: true } });
        if (!referrer || referrer.status !== 'ACTIVE') {
            throw new ApiError(404, 'Referrer user not found');
        }
        const existing = await tx.referral.findUnique({ where: { referredUserId } });
        if (existing) {
            throw new ApiError(409, 'Referral already applied for this account');
        }
        return await tx.referral.create({
            data: { referrerId, referredUserId, status: 'PENDING' },
        });
    });

export const rewardReferralTx = (referralId: string, rewardCoins: number, actor: Actor) =>
    prisma.$transaction(
        async (tx) => {
            const ref = await tx.referral.findUnique({ where: { id: referralId } });
            if (!ref) throw new ApiError(404, 'Referral not found');
            if (ref.status === 'REWARDED') throw new ApiError(400, 'Referral is already rewarded');
            if (ref.status === 'VOID') throw new ApiError(400, 'Referral is void');

            const account = await tx.coinAccount.upsert({
                where: { userId: ref.referrerId },
                create: { userId: ref.referrerId, balance: 0 },
                update: {},
            });

            const newBalance = account.balance + rewardCoins;
            await tx.coinAccount.update({
                where: { id: account.id },
                data: { balance: newBalance },
            });

            await tx.coinTransaction.create({
                data: {
                    accountId: account.id,
                    type: 'REFERRAL_REWARD',
                    amount: rewardCoins,
                    balanceAfter: newBalance,
                    referenceType: 'REFERRAL',
                    referenceId: ref.id,
                },
            });

            const updated = await tx.referral.update({
                where: { id: ref.id },
                data: { status: 'REWARDED', rewardCoins, rewardedAt: new Date() },
            });

            await tx.auditLog.create({
                data: {
                    actorId: actor.id,
                    actorRole: actor.role,
                    action: 'REFERRAL_REWARDED',
                    entityType: 'Referral',
                    entityId: ref.id,
                    after: { rewardCoins, referrerBalance: newBalance } as any,
                },
            });

            return { referral: updated, referrerCoinBalance: newBalance };
        },
        { maxWait: 10000, timeout: 30000 }
    );
