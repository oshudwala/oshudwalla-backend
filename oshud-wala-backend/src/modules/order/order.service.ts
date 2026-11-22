import { OrderStatus, RoleName } from '@prisma/client';
import { ApiError } from '../../utils/apiError';
import * as repo from './order.repository';

type Actor = { id: string; role: RoleName };

const ALLOWED_PHARMACY_TRANSITIONS: Record<string, OrderStatus[]> = {
    PENDING_PHARMACY_REVIEW: ['ACCEPTED', 'REJECTED'],
    ACCEPTED: ['PREPARING'],
    PREPARING: ['READY_FOR_PICKUP'],
};

export const placeOrder = async (body: any, actor: Actor) => {
    return await repo.placeOrderFromCartTx(
        actor.id,
        body.addressId,
        body.pharmacyId ?? null,
        body.prescriptionId ?? null,
        body.couponCode ? String(body.couponCode).trim().toUpperCase() : null,
        body.idempotencyKey ? String(body.idempotencyKey).trim() : null,
        actor
    );
};

export const getMyOrders = async (patientId: string) => {
    return await repo.listPatientOrders(patientId);
};

export const getPharmacyOrders = async (pharmacyId: string, actor: Actor) => {
    if (actor.role !== 'SUPER_ADMIN') {
        const link = await repo.findActiveOwnerLink(actor.id, pharmacyId);
        if (!link) throw new ApiError(403, 'You can only view orders for your own pharmacy');
    }
    return await repo.listPharmacyOrders(pharmacyId);
};

export const updateOrderStatus = async (
    orderId: string,
    toStatus: OrderStatus,
    reason: string | null | undefined,
    actor: Actor
) => {
    const order = await repo.findOrderById(orderId);
    if (!order) throw new ApiError(404, 'Order not found');

    if (actor.role !== 'SUPER_ADMIN') {
        const link = await repo.findActiveOwnerLink(actor.id, order.pharmacyId);
        if (!link) throw new ApiError(403, 'You can only manage orders for your own pharmacy');
    }

    const allowed = ALLOWED_PHARMACY_TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(toStatus)) {
        throw new ApiError(400, `Invalid order transition from ${order.status} to ${toStatus}`);
    }

    return await repo.transitionOrderStatusTx(order, toStatus, reason ? String(reason).trim() : null, actor);
};

export const cancelOrder = async (orderId: string, cancelReason: string | null | undefined, actor: Actor) => {
    const order = await repo.findOrderById(orderId);
    if (!order) throw new ApiError(404, 'Order not found');

    if (actor.role === 'PATIENT' && order.patientId !== actor.id) {
        throw new ApiError(403, 'You can only cancel your own order');
    }

    if (order.status !== 'PENDING_PHARMACY_REVIEW' && order.status !== 'ACCEPTED') {
        throw new ApiError(400, `Cannot cancel order in ${order.status} status`);
    }

    return await repo.transitionOrderStatusTx(
        order,
        'CANCELLED',
        cancelReason ? String(cancelReason).trim() : null,
        actor
    );
};
