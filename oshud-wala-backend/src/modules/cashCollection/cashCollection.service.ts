import { RoleName } from '@prisma/client';
import * as repo from './cashCollection.repository';

type Actor = { id: string; role: RoleName };

export const getMyCash = async (riderId: string) => repo.getRiderCashSummary(riderId);

export const submitDeposit = async (riderId: string, body: any) =>
    repo.submitDepositTx(
        riderId,
        Array.from(new Set<string>(body.collectionIds)),
        body.method,
        body.referenceNo ? String(body.referenceNo).trim() : null
    );

export const verifyDeposit = async (depositId: string, body: any, actor: Actor) =>
    repo.verifyDepositTx(
        depositId,
        body.decision,
        body.rejectionReason ? String(body.rejectionReason).trim() : null,
        actor
    );
