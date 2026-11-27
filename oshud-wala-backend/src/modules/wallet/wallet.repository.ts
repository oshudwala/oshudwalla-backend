import { RoleName, WalletOwnerType } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/apiError';

type Actor = { id: string; role: RoleName };

const ownerTypeForRole = (role: RoleName): WalletOwnerType => {
    if (role === 'RIDER') return 'RIDER';
    if (role === 'PHARMACY') return 'PHARMACY';
    return 'CUSTOMER';
};

export const serializeBigInts = (obj: any): any =>
    JSON.parse(JSON.stringify(obj, (_, v) => (typeof v === 'bigint' ? v.toString() : v)));

export const getOrCreateUserWallet = async (userId: string, role: RoleName) => {
    const ownerType = ownerTypeForRole(role);
    const ownerKey = `${ownerType}:${userId}`;
    const wallet = await prisma.wallet.upsert({
        where: { ownerKey },
        create: { ownerKey, ownerType, userId, balancePaise: BigInt(0), heldPaise: BigInt(0) },
        update: {},
        include: {
            entries: {
                orderBy: { createdAt: 'desc' },
                take: 30,
                include: { transaction: { select: { txType: true, description: true, referenceType: true, referenceId: true } } },
            },
        },
    });
    return serializeBigInts(wallet);
};

export const requestWithdrawalTx = (
    userId: string,
    role: RoleName,
    amountPaise: number,
    payoutDetails: any,
    idempotencyKey: string | null
) =>
    prisma.$transaction(
        async (tx) => {
            if (idempotencyKey) {
                const existing = await tx.withdrawalRequest.findUnique({
                    where: { requestedById_idempotencyKey: { requestedById: userId, idempotencyKey } },
                });
                if (existing) return serializeBigInts(existing);
            }

            const ownerType = ownerTypeForRole(role);
            const ownerKey = `${ownerType}:${userId}`;
            const wallet = await tx.wallet.upsert({
                where: { ownerKey },
                create: { ownerKey, ownerType, userId, balancePaise: BigInt(0), heldPaise: BigInt(0) },
                update: {},
            });

            // Row-level lock to prevent concurrent withdrawal overdraws
            const locked = await tx.$queryRaw<
                Array<{ id: string; balancePaise: bigint; heldPaise: bigint }>
            >`SELECT id, "balancePaise", "heldPaise" FROM wallets WHERE id = ${wallet.id}::uuid FOR UPDATE`;

            const w = locked[0];
            const amt = BigInt(amountPaise);
            if (w.balancePaise < amt) {
                throw new ApiError(400, 'Insufficient wallet balance for withdrawal');
            }

            const isRiderInstant = role === 'RIDER';
            const reqStatus = isRiderInstant ? 'PAID' : 'REQUESTED';
            const now = new Date();

            const newBalance = w.balancePaise - amt;
            const newHeld = isRiderInstant ? w.heldPaise : w.heldPaise + amt;

            await tx.wallet.update({
                where: { id: w.id },
                data: { balancePaise: newBalance, heldPaise: newHeld, version: { increment: 1 } },
            });

            const reqRow = await tx.withdrawalRequest.create({
                data: {
                    walletId: w.id,
                    requestedById: userId,
                    amountPaise: amt,
                    status: reqStatus,
                    payoutDetails,
                    idempotencyKey,
                    ...(isRiderInstant ? { reviewedById: userId, reviewedAt: now } : {}),
                },
            });

            const ledgerTx = await tx.ledgerTransaction.create({
                data: {
                    txType: isRiderInstant ? 'WITHDRAWAL_PAYOUT' : 'WITHDRAWAL_HOLD',
                    referenceType: 'WITHDRAWAL',
                    referenceId: reqRow.id,
                    idempotencyKey: `WITHDRAWAL:${reqRow.id}`,
                    description: `Withdrawal payout (${payoutDetails?.method || 'CASH'})`,
                    createdBy: userId,
                },
            });

            await tx.ledgerEntry.create({
                data: {
                    transactionId: ledgerTx.id,
                    walletId: w.id,
                    entryType: isRiderInstant ? 'DEBIT' : 'HOLD',
                    amountPaise: amt,
                    balanceAfterPaise: newBalance,
                    heldAfterPaise: newHeld,
                },
            });

            if (isRiderInstant) {
                await tx.settlement.create({
                    data: {
                        type: 'WITHDRAWAL_PAYOUT',
                        amountPaise: amt,
                        method: payoutDetails?.method || 'OFFLINE_CASH',
                        referenceNo: `WTH-${reqRow.id.slice(0, 8).toUpperCase()}`,
                        withdrawalRequestId: reqRow.id,
                        settledById: userId,
                    },
                });
            }

            return serializeBigInts(reqRow);
        },
        { maxWait: 10000, timeout: 30000 }
    );

const isUuid = (val: any): boolean =>
    typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);

export const listWithdrawals = async (actor: Actor) => {
    let targetUserId = actor.id;
    if (isUuid(actor.id)) {
        const profile = await prisma.riderProfile.findFirst({
            where: { OR: [{ userId: actor.id }, { id: actor.id }] },
        });
        if (profile) targetUserId = profile.userId;
    }

    const rows = await prisma.withdrawalRequest.findMany({
        where: actor.role === 'SUPER_ADMIN' ? {} : {
            OR: [
                { requestedById: targetUserId },
                ...(targetUserId !== actor.id ? [{ requestedById: actor.id }] : []),
            ],
        },
        orderBy: { requestedAt: 'desc' },
        include: { settlement: true },
    });
    return serializeBigInts(rows);
};

export const reviewWithdrawalTx = (
    withdrawalId: string,
    decision: 'PAID' | 'REJECTED',
    method: string,
    referenceNo: string | null,
    rejectionReason: string | null,
    actor: Actor
) =>
    prisma.$transaction(
        async (tx) => {
            const reqRow = await tx.withdrawalRequest.findUnique({ where: { id: withdrawalId } });
            if (!reqRow) throw new ApiError(404, 'Withdrawal request not found');
            if (reqRow.status !== 'REQUESTED' && reqRow.status !== 'APPROVED') {
                throw new ApiError(400, `Withdrawal request is already ${reqRow.status}`);
            }

            const locked = await tx.$queryRaw<
                Array<{ id: string; balancePaise: bigint; heldPaise: bigint }>
            >`SELECT id, "balancePaise", "heldPaise" FROM wallets WHERE id = ${reqRow.walletId}::uuid FOR UPDATE`;

            const w = locked[0];
            const amt = reqRow.amountPaise;

            if (decision === 'PAID') {
                const newHeld = w.heldPaise - amt;
                await tx.wallet.update({
                    where: { id: w.id },
                    data: { heldPaise: newHeld, version: { increment: 1 } },
                });

                const ledgerTx = await tx.ledgerTransaction.create({
                    data: {
                        txType: 'WITHDRAWAL_PAYOUT',
                        referenceType: 'WITHDRAWAL',
                        referenceId: reqRow.id,
                        idempotencyKey: `WITHDRAWAL_PAYOUT:${reqRow.id}`,
                        description: `Withdrawal payout (${referenceNo || method})`,
                        createdBy: actor.id,
                    },
                });

                await tx.ledgerEntry.create({
                    data: {
                        transactionId: ledgerTx.id,
                        walletId: w.id,
                        entryType: 'HOLD_CAPTURE',
                        amountPaise: amt,
                        balanceAfterPaise: w.balancePaise,
                        heldAfterPaise: newHeld,
                    },
                });

                const settlement = await tx.settlement.create({
                    data: {
                        type: 'WITHDRAWAL_PAYOUT',
                        amountPaise: amt,
                        method,
                        referenceNo,
                        withdrawalRequestId: reqRow.id,
                        settledById: actor.id,
                        ledgerTransactionId: ledgerTx.id,
                    },
                });

                const updated = await tx.withdrawalRequest.update({
                    where: { id: reqRow.id },
                    data: { status: 'PAID', reviewedById: actor.id, reviewedAt: new Date() },
                });

                return serializeBigInts({ withdrawal: updated, settlement });
            } else {
                // REJECTED -> release held funds back to balancePaise
                const newHeld = w.heldPaise - amt;
                const newBalance = w.balancePaise + amt;

                await tx.wallet.update({
                    where: { id: w.id },
                    data: { balancePaise: newBalance, heldPaise: newHeld, version: { increment: 1 } },
                });

                const ledgerTx = await tx.ledgerTransaction.create({
                    data: {
                        txType: 'WITHDRAWAL_RELEASE',
                        referenceType: 'WITHDRAWAL',
                        referenceId: reqRow.id,
                        idempotencyKey: `WITHDRAWAL_RELEASE:${reqRow.id}`,
                        description: `Withdrawal rejected: ${rejectionReason}`,
                        createdBy: actor.id,
                    },
                });

                await tx.ledgerEntry.create({
                    data: {
                        transactionId: ledgerTx.id,
                        walletId: w.id,
                        entryType: 'RELEASE',
                        amountPaise: amt,
                        balanceAfterPaise: newBalance,
                        heldAfterPaise: newHeld,
                    },
                });

                const updated = await tx.withdrawalRequest.update({
                    where: { id: reqRow.id },
                    data: {
                        status: 'REJECTED',
                        rejectionReason,
                        reviewedById: actor.id,
                        reviewedAt: new Date(),
                    },
                });

                return serializeBigInts({ withdrawal: updated });
            }
        },
        { maxWait: 10000, timeout: 30000 }
    );
