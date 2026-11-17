import { Prisma, RoleName } from '@prisma/client';
import { ApiError } from '../../utils/apiError';
import * as repo from './location.repository';
import { LOCATION_AUDIT } from './location.constants';

type Actor = { id: string; role: RoleName };

const clean = (v: string) => v.trim().replace(/\s+/g, ' ');

export const createLocation = async (body: any, actor: Actor) => {
    const city = clean(body.city);
    const area = body.area ? clean(body.area) : null;
    const uniqueKey = repo.buildUniqueKey(city, area, body.pincode);

    if (await repo.findByUniqueKey(uniqueKey)) {
        throw new ApiError(409, 'This location (city + area + PIN) already exists');
    }

    // explicit whitelist: nothing else from the request body reaches the database
    return repo.createWithAudit(
        {
            city,
            area,
            state: clean(body.state),
            pincode: body.pincode,
            country: body.country ? clean(body.country) : 'India',
            latitude: body.latitude ?? null,
            longitude: body.longitude ?? null,
            uniqueKey,
        },
        actor,
        LOCATION_AUDIT.CREATE
    );
};

export const updateLocation = async (id: string, body: any, actor: Actor) => {
    const existing = await repo.findById(id);
    if (!existing) throw new ApiError(404, 'Location not found');

    const city = body.city !== undefined ? clean(body.city) : existing.city;
    const area = body.area !== undefined ? (body.area ? clean(body.area) : null) : existing.area;
    const pincode = body.pincode ?? existing.pincode;

    const lat = body.latitude !== undefined ? body.latitude : existing.latitude;
    const lng = body.longitude !== undefined ? body.longitude : existing.longitude;
    if ((lat == null) !== (lng == null)) {
        throw new ApiError(400, 'latitude and longitude must be provided together');
    }

    const uniqueKey = repo.buildUniqueKey(city, area, pincode);
    if (uniqueKey !== existing.uniqueKey) {
        const clash = await repo.findByUniqueKey(uniqueKey);
        if (clash) throw new ApiError(409, 'Another location with the same city + area + PIN already exists');
    }

    const data: Prisma.LocationUpdateInput = { city, area, pincode, uniqueKey };
    if (body.state !== undefined) data.state = clean(body.state);
    if (body.country !== undefined) data.country = clean(body.country);
    if (body.latitude !== undefined) data.latitude = body.latitude;
    if (body.longitude !== undefined) data.longitude = body.longitude;

    return repo.updateWithAudit(id, existing, data, actor, LOCATION_AUDIT.UPDATE);
};

export const setStatus = async (id: string, isActive: boolean, actor: Actor) => {
    const existing = await repo.findById(id);
    if (!existing) throw new ApiError(404, 'Location not found');
    if (existing.isActive === isActive) return existing; // idempotent, no duplicate audit
    return repo.updateWithAudit(
        id,
        existing,
        { isActive },
        actor,
        isActive ? LOCATION_AUDIT.ACTIVATE : LOCATION_AUDIT.DEACTIVATE
    );
};

export const getLocation = async (id: string, onlyActive: boolean) => {
    const loc = await repo.findById(id);
    if (!loc || (onlyActive && !loc.isActive)) throw new ApiError(404, 'Location not found');
    return loc;
};

export const listLocations = async (q: any, isAdmin: boolean) => {
    const where: Prisma.LocationWhereInput = {};
    if (!isAdmin) where.isActive = true; // public/patient: active only, always
    else if (q.isActive !== undefined) where.isActive = q.isActive === 'true';

    if (q.city) where.city = { equals: q.city, mode: 'insensitive' };
    if (q.state) where.state = { equals: q.state, mode: 'insensitive' };
    if (q.q) {
        where.OR = [
            { city: { contains: q.q, mode: 'insensitive' } },
            { area: { contains: q.q, mode: 'insensitive' } },
            { pincode: { contains: q.q } },
        ];
    }
    const { items, total } = await repo.list(where, q.page, q.limit);
    return { items, page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) };
};
