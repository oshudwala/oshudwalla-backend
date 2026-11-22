import { RoleName } from '@prisma/client';
import { ApiError } from '../../utils/apiError';
import * as repo from './category.repository';

type Actor = { id: string; role: RoleName };

const toSlug = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const listCategories = async (parentId?: string) => {
    return await repo.listActive(parentId === 'null' ? null : parentId);
};

export const createCategory = async (body: any, actor: Actor) => {
    const slug = body.slug ? body.slug.trim().toLowerCase() : toSlug(body.name);
    if (body.parentId) {
        const parent = await repo.findById(body.parentId);
        if (!parent) throw new ApiError(404, 'Parent category not found');
    }
    try {
        return await repo.createWithAudit(
            {
                name: String(body.name).trim(),
                slug,
                parentId: body.parentId ?? null,
                imageUrl: body.imageUrl ?? null,
                sortOrder: body.sortOrder ?? 0,
                isActive: body.isActive ?? true,
            },
            actor
        );
    } catch (error: any) {
        if (error?.code === 'P2002') throw new ApiError(409, 'Category with this slug already exists');
        throw new ApiError(500, 'Failed to create category');
    }
};

export const updateCategory = async (id: string, body: any, actor: Actor) => {
    const existing = await repo.findById(id);
    if (!existing) throw new ApiError(404, 'Category not found');

    const data: any = {};
    if (body.name !== undefined) data.name = String(body.name).trim();
    if (body.parentId !== undefined) data.parentId = body.parentId;
    if (body.imageUrl !== undefined) data.imageUrl = body.imageUrl;
    if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder;
    if (body.isActive !== undefined) data.isActive = body.isActive;

    return await repo.updateWithAudit(id, existing, data, actor);
};
