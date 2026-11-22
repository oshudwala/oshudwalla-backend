import { RoleName } from '@prisma/client';
import * as repo from './referral.repository';

type Actor = { id: string; role: RoleName };

export const getMyReferralSummary = (userId: string) => repo.getMyReferralAndCoins(userId);
export const applyReferral = (userId: string, referrerId: string) => repo.applyReferralTx(userId, referrerId);
export const rewardReferral = (id: string, rewardCoins: number, actor: Actor) => repo.rewardReferralTx(id, rewardCoins, actor);
