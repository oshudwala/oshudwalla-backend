import { RoleName } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/apiError';
import { serializeBigInts } from '../wallet/wallet.repository';

type Actor = { id: string; role: RoleName };

const isUuid = (val: any): boolean =>
    typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);

export const getRiderCashSummary = async (riderId: string) => {
    let targetUserId = riderId;
    if (isUuid(riderId)) {
        const profile = await prisma.riderProfile.findFirst({
            where: { OR: [{ userId: riderId }, { id: riderId }] },
        });
        if (profile) targetUserId = profile.userId;
    }

    const collections = await prisma.cashCollection.findMany({
        where: {
            OR: [
                { riderId: targetUserId },
                ...(riderId !== targetUserId ? [{ riderId }] : []),
            ],
        },
        orderBy: { collectedAt: 'desc' },
        include: {
            order: {
                select: {
                    id: true,
                    orderNumber: true,
                    totalPaise: true,
                    deliveryAddress: true,
                    patient: { select: { fullName: true } },
                },
            },
        },
    });

    const deposits = await prisma.cashDeposit.findMany({
        where: {
            OR: [
                { riderId: targetUserId },
                ...(riderId !== targetUserId ? [{ riderId }] : []),
            ],
        },
        orderBy: { submittedAt: 'desc' },
    });

    const totalCollectedPaise = collections.reduce((sum, c) => sum + c.amountPaise, 0);
    const totalDepositedPaise = deposits
        .filter((d) => d.status !== 'REJECTED')
        .reduce((sum, d) => sum + d.amountPaise, 0);

    const cashInHandPaise = Math.max(0, totalCollectedPaise - totalDepositedPaise);
    const cashInHand = cashInHandPaise / 100;

    return {
        cashInHandPaise,
        cashInHand,
        totalCollectedPaise,
        totalDepositedPaise,
        collections: collections.map((c) => ({
            id: c.id,
            orderId: c.order?.orderNumber || c.order?.id || c.orderId,
            customerName: (c.order?.deliveryAddress as any)?.fullName || c.order?.patient?.fullName || 'Customer',
            amount: c.amountPaise / 100,
            amountPaise: c.amountPaise,
            collectedAt: c.collectedAt,
            status: c.status,
            depositId: c.depositId,
        })),
        deposits: deposits.map((d) => ({
            id: d.id,
            depositId: d.referenceNo || `DEP-${d.id.slice(0, 8).toUpperCase()}`,
            amount: d.amountPaise / 100,
            amountPaise: d.amountPaise,
            status: d.status,
            method: d.method,
            submittedAt: d.submittedAt,
        })),
    };
};

export const submitDepositTx = (
    riderId: string,
    amountPaise?: number,
    method?: string,
    referenceNo?: string | null,
    collectionIds?: string[]
) =>
    prisma.$transaction(
        async (tx) => {
            let targetUserId = riderId;
            if (isUuid(riderId)) {
                const profile = await tx.riderProfile.findFirst({
                    where: { OR: [{ userId: riderId }, { id: riderId }] },
                });
                if (profile) targetUserId = profile.userId;
            }

            const collections = await tx.cashCollection.findMany({
                where: {
                    OR: [
                        { riderId: targetUserId },
                        ...(riderId !== targetUserId ? [{ riderId }] : []),
                    ],
                },
            });
            const deposits = await tx.cashDeposit.findMany({
                where: {
                    OR: [
                        { riderId: targetUserId },
                        ...(riderId !== targetUserId ? [{ riderId }] : []),
                    ],
                    status: { not: 'REJECTED' },
                },
            });

            const totalCollected = collections.reduce((s, c) => s + c.amountPaise, 0);
            const totalDeposited = deposits.reduce((s, d) => s + d.amountPaise, 0);
            const currentCashInHandPaise = Math.max(0, totalCollected - totalDeposited);

            let depositPaise = amountPaise || 0;
            if (!depositPaise && collectionIds && collectionIds.length > 0) {
                depositPaise = collections
                    .filter((c) => collectionIds.includes(c.id))
                    .reduce((s, c) => s + c.amountPaise, 0);
            }

            if (depositPaise <= 0) {
                throw new ApiError(400, 'Deposit amount must be greater than ₹0');
            }

            if (depositPaise > currentCashInHandPaise) {
                throw new ApiError(
                    400,
                    `Deposit amount (₹${(depositPaise / 100).toFixed(2)}) exceeds physical cash in hand (₹${(currentCashInHandPaise / 100).toFixed(2)})`
                );
            }

            const refId = referenceNo || `DEP-${Date.now().toString().slice(-6)}`;
            const deposit = await tx.cashDeposit.create({
                data: {
                    riderId: targetUserId,
                    amountPaise: depositPaise,
                    method: method || 'CASH_HANDOVER',
                    referenceNo: refId,
                    status: 'SUBMITTED',
                },
            });

            if (collectionIds && collectionIds.length > 0) {
                await tx.cashCollection.updateMany({
                    where: { id: { in: collectionIds } },
                    data: { status: 'DEPOSITED', depositId: deposit.id },
                });
            } else {
                const pendingCollections = collections.filter((c) => c.status === 'COLLECTED');
                let remaining = depositPaise;
                const toMarkIds: string[] = [];
                for (const col of pendingCollections) {
                    if (remaining <= 0) break;
                    toMarkIds.push(col.id);
                    remaining -= col.amountPaise;
                }
                if (toMarkIds.length > 0) {
                    await tx.cashCollection.updateMany({
                        where: { id: { in: toMarkIds } },
                        data: { status: 'DEPOSITED', depositId: deposit.id },
                    });
                }
            }

            return serializeBigInts(deposit);
        },
        { maxWait: 10000, timeout: 30000 }
    );

export const verifyDepositTx = (
    depositId: string,
    decision: 'VERIFIED' | 'REJECTED',
    rejectionReason: string | null,
    actor: Actor
) =>
    prisma.$transaction(
        async (tx) => {
            const deposit = await tx.cashDeposit.findUnique({ where: { id: depositId } });
            if (!deposit) throw new ApiError(404, 'Cash deposit not found');
            if (deposit.status !== 'SUBMITTED') {
                throw new ApiError(400, `Cash deposit is already ${deposit.status}`);
            }

            const now = new Date();
            if (decision === 'VERIFIED') {
                const updated = await tx.cashDeposit.update({
                    where: { id: depositId },
                    data: { status: 'VERIFIED', verifiedById: actor.id, verifiedAt: now },
                });

                await tx.cashCollection.updateMany({
                    where: { depositId },
                    data: { status: 'VERIFIED', verifiedAt: now },
                });

                const settlement = await tx.settlement.create({
                    data: {
                        type: 'COD_CASH_DEPOSIT',
                        amountPaise: BigInt(deposit.amountPaise),
                        method: deposit.method,
                        referenceNo: deposit.referenceNo,
                        cashDepositId: deposit.id,
                        settledById: actor.id,
                    },
                });

                return serializeBigInts({ deposit: updated, settlement });
            } else {
                const updated = await tx.cashDeposit.update({
                    where: { id: depositId },
                    data: { status: 'REJECTED', rejectionReason, verifiedById: actor.id, verifiedAt: now },
                });

                await tx.cashCollection.updateMany({
                    where: { depositId },
                    data: { status: 'COLLECTED', depositId: null },
                });

                return serializeBigInts({ deposit: updated });
            }
        },
        { maxWait: 10000, timeout: 30000 }
    );
