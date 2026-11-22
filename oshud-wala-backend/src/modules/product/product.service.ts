import { Prisma, RoleName } from '@prisma/client';
import { ApiError } from '../../utils/apiError';
import * as repo from './product.repository';

type Actor = { id: string; role: RoleName };

const toSlug = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const listProducts = async (q: any) => {
    const where: Prisma.ProductWhereInput = { isActive: true };
    if (q.categoryId) where.categoryId = q.categoryId;
    if (q.requiresPrescription !== undefined) where.requiresPrescription = q.requiresPrescription === 'true';
    if (q.q) {
        where.OR = [
            { name: { contains: q.q, mode: 'insensitive' } },
            { genericName: { contains: q.q, mode: 'insensitive' } },
            { manufacturer: { contains: q.q, mode: 'insensitive' } },
        ];
    }
    const { items, total } = await repo.list(where, q.page, q.limit);
    return { items, page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) };
};

export const getProduct = async (id: string) => {
    const prod = await repo.findById(id);
    if (!prod || !prod.isActive) throw new ApiError(404, 'Product not found');
    return prod;
};

export const createProduct = async (body: any, actor: Actor) => {
    const cat = await repo.findCategoryById(body.categoryId);
    if (!cat) throw new ApiError(404, 'Category not found');

    const slug = body.slug ? body.slug.trim().toLowerCase() : toSlug(body.name);
    try {
        return await repo.createWithAudit(
            {
                name: String(body.name).trim(),
                slug,
                genericName: body.genericName ? String(body.genericName).trim() : null,
                manufacturer: body.manufacturer ? String(body.manufacturer).trim() : null,
                categoryId: body.categoryId,
                description: body.description ? String(body.description).trim() : null,
                packSize: body.packSize ? String(body.packSize).trim() : null,
                mrpPaise: body.mrpPaise,
                requiresPrescription: body.requiresPrescription ?? false,
                imageUrls: body.imageUrls ?? [],
                isActive: body.isActive ?? true,
            },
            actor
        );
    } catch (error: any) {
        if (error?.code === 'P2002') throw new ApiError(409, 'Product with this slug already exists');
        throw new ApiError(500, 'Failed to create product');
    }
};

export const updateProduct = async (id: string, body: any, actor: Actor) => {
    const existing = await repo.findById(id);
    if (!existing) throw new ApiError(404, 'Product not found');

    if (body.categoryId) {
        const cat = await repo.findCategoryById(body.categoryId);
        if (!cat) throw new ApiError(404, 'Category not found');
    }

    const data: any = {};
    if (body.name !== undefined) data.name = String(body.name).trim();
    if (body.genericName !== undefined) data.genericName = body.genericName ? String(body.genericName).trim() : null;
    if (body.manufacturer !== undefined) data.manufacturer = body.manufacturer ? String(body.manufacturer).trim() : null;
    if (body.categoryId !== undefined) data.categoryId = body.categoryId;
    if (body.description !== undefined) data.description = body.description ? String(body.description).trim() : null;
    if (body.packSize !== undefined) data.packSize = body.packSize ? String(body.packSize).trim() : null;
    if (body.mrpPaise !== undefined) data.mrpPaise = body.mrpPaise;
    if (body.requiresPrescription !== undefined) data.requiresPrescription = body.requiresPrescription;
    if (body.imageUrls !== undefined) data.imageUrls = body.imageUrls;
    if (body.isActive !== undefined) data.isActive = body.isActive;

    return await repo.updateWithAudit(id, existing, data, actor);
};
