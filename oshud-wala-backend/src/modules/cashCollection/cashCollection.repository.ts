import { RoleName } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/apiError';
import { serializeBigInts } from '../wallet/wallet.repository';

type Actor = { id: string; role: RoleName };

export const getRiderCashSummary = async (riderId: string) => {
    const collections = await prisma.cashCollection.findMany({
        where: { riderId },
        orderBy: { collectedAt: 'desc' },
        include: { order: { select: { id: true, orderNumber: true, totalPaise: true } } },
    });
    const pendingCashPaise = collections
        .filter((c) => c.status === 'COLLECTED' || c.status === 'DEPOSIT_PENDING')
        .reduce((sum, c) => sum + c.amountPaise, 0);
    return { pendingCashPaise, collections };
};

export const submitDepositTx = (riderId: string, collectionIds: string[], method: string, referenceNo: string | null) =>
    prisma.$transaction(
        async (tx) => {
            const rows = await tx.cashCollection.findMany({
                where: { id: { in: collectionIds }, riderId },
            });
            if (rows.length !== collectionIds.length) {
                throw new ApiError(404, 'One or more cash collections not found for this rider');
            }
            for (const r of rows) {
                if (r.status !== 'COLLECTED') {
                    throw new ApiError(400, `Cash collection ${r.id} is already ${r.status}`);
                }
            }

            const totalPaise = rows.reduce((sum, r) => sum + r.amountPaise, 0);
            const deposit = await tx.cashDeposit.create({
                data: {
                    riderId,
                    amountPaise: totalPaise,
                    method,
                    referenceNo,
                    status: 'SUBMITTED',
                },
            });

            await tx.cashCollection.updateMany({
                where: { id: { in: collectionIds } },
                data: { status: 'DEPOSITED', depositId: deposit.id },
            });

            return deposit;
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
