import { RoleName } from '@prisma/client';
import * as repo from './wallet.repository';

type Actor = { id: string; role: RoleName };

export const getMyWallet = async (actor: Actor) => repo.getOrCreateUserWallet(actor.id, actor.role);

export const requestWithdrawal = async (body: any, actor: Actor) => {
    const amountPaise = body.amountPaise || (body.amount ? Math.round(Number(body.amount) * 100) : 0);
    return repo.requestWithdrawalTx(
        actor.id,
        actor.role,
        amountPaise,
        body.payoutDetails,
        body.idempotencyKey ? String(body.idempotencyKey).trim() : null
    );
};

export const listWithdrawals = async (actor: Actor) => repo.listWithdrawals(actor);

export const reviewWithdrawal = async (id: string, body: any, actor: Actor) =>
    repo.reviewWithdrawalTx(
        id,
        body.decision,
        body.method ? String(body.method).trim() : 'BANK_TRANSFER',
        body.referenceNo ? String(body.referenceNo).trim() : null,
        body.rejectionReason ? String(body.rejectionReason).trim() : null,
        actor
    );
