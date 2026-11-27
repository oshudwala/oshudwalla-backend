import { RoleName } from '@prisma/client';
import * as repo from './cashCollection.repository';

type Actor = { id: string; role: RoleName };

export const getMyCash = async (riderId: string) => repo.getRiderCashSummary(riderId);

export const submitDeposit = async (riderId: string, body: any) => {
    const amountPaise = body.amountPaise || (body.amount ? Math.round(Number(body.amount) * 100) : undefined);
    const collectionIds = Array.isArray(body.collectionIds) ? Array.from(new Set<string>(body.collectionIds)) : undefined;
    return repo.submitDepositTx(
        riderId,
        amountPaise,
        body.method || 'CASH_HANDOVER',
        body.referenceNo ? String(body.referenceNo).trim() : null,
        collectionIds
    );
};

export const verifyDeposit = async (depositId: string, body: any, actor: Actor) =>
    repo.verifyDepositTx(
        depositId,
        body.decision,
        body.rejectionReason ? String(body.rejectionReason).trim() : null,
        actor,
        body.password
    );

export const listDeposits = async (riderId?: string) => repo.listAllDeposits(riderId);

export const listRiderCashSummaries = async () => repo.listAllRidersCashOverview();
