import { RoleName } from '@prisma/client';
import { ApiError } from '../../utils/apiError';
import * as repo from './promotion.repository';

type Actor = { id: string; role: RoleName };

export const listPublic = (placement?: string) => repo.listPublicPromotions(placement);
export const listAdmin = () => repo.listAllPromotions();

export const createPromotion = async (body: any, actor: Actor) => {
    return await repo.createTx(
        {
            heading: String(body.heading).trim(),
            paragraph: body.paragraph ? String(body.paragraph).trim() : null,
            imageUrl: String(body.imageUrl).trim(),
            buttonText: body.buttonText ? String(body.buttonText).trim() : null,
            buttonLink: body.buttonLink ? String(body.buttonLink).trim() : null,
            secondaryButtonText: body.secondaryButtonText ? String(body.secondaryButtonText).trim() : null,
            secondaryButtonLink: body.secondaryButtonLink ? String(body.secondaryButtonLink).trim() : null,
            couponCode: body.couponCode ? String(body.couponCode).trim().toUpperCase() : null,
            placement: body.placement ? String(body.placement).trim() : 'HOME_TOP',
            sortOrder: body.sortOrder ?? 0,
            isActive: body.isActive ?? true,
            validFrom: body.validFrom ? new Date(body.validFrom) : null,
            validTo: body.validTo ? new Date(body.validTo) : null,
        },
        actor
    );
};

export const updatePromotion = async (id: string, body: any, actor: Actor) => {
    const existing = await repo.findById(id);
    if (!existing) throw new ApiError(404, 'Promotion not found');

    const data: any = {};
    if (body.heading !== undefined) data.heading = String(body.heading).trim();
    if (body.paragraph !== undefined) data.paragraph = body.paragraph ? String(body.paragraph).trim() : null;
    if (body.imageUrl !== undefined) data.imageUrl = String(body.imageUrl).trim();
    if (body.buttonText !== undefined) data.buttonText = body.buttonText ? String(body.buttonText).trim() : null;
    if (body.buttonLink !== undefined) data.buttonLink = body.buttonLink ? String(body.buttonLink).trim() : null;
    if (body.secondaryButtonText !== undefined) data.secondaryButtonText = body.secondaryButtonText ? String(body.secondaryButtonText).trim() : null;
    if (body.secondaryButtonLink !== undefined) data.secondaryButtonLink = body.secondaryButtonLink ? String(body.secondaryButtonLink).trim() : null;
    if (body.couponCode !== undefined) data.couponCode = body.couponCode ? String(body.couponCode).trim().toUpperCase() : null;
    if (body.placement !== undefined) data.placement = String(body.placement).trim();
    if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder;
    if (body.isActive !== undefined) data.isActive = body.isActive;
    if (body.validFrom !== undefined) data.validFrom = body.validFrom ? new Date(body.validFrom) : null;
    if (body.validTo !== undefined) data.validTo = body.validTo ? new Date(body.validTo) : null;

    return await repo.updateTx(id, existing, data, actor);
};

export const deletePromotion = async (id: string, actor: Actor) => {
    const existing = await repo.findById(id);
    if (!existing) throw new ApiError(404, 'Promotion not found');
    await repo.deleteTx(id, existing, actor);
    return { deleted: true, id };
};
