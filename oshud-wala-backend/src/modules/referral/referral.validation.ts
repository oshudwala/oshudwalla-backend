import { z } from 'zod';

export const applyReferralSchema = z.object({
    body: z.object({
        referrerId: z.string().uuid('Valid referrerId is required'),
    }),
});

export const rewardReferralSchema = z.object({
    params: z.object({ id: z.string().uuid('Invalid referral id') }),
    body: z.object({
        rewardCoins: z.number().int().min(1).max(10000).default(50),
    }),
});
