import crypto from 'crypto';
import { OrderStatus, RoleName } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/apiError';

type Actor = { id: string; role: RoleName };

export const findActiveOwnerLink = (userId: string, pharmacyId: string) =>
    prisma.pharmacyStaff.findFirst({ where: { userId, pharmacyId, staffRole: 'OWNER', isActive: true } });

export const findOrderById = (id: string) =>
    prisma.order.findUnique({ where: { id }, include: { items: true } });

export const placeOrderFromCartTx = (
    patientId: string,
    addressId: string,
    pharmacyId: string | null,
    prescriptionId: string | null,
    couponCode: string | null,
    idempotencyKey: string | null,
    actor: Actor
) =>
    prisma.$transaction(
        async (tx) => {
            if (idempotencyKey) {
                const existing = await tx.order.findUnique({
                    where: { patientId_idempotencyKey: { patientId, idempotencyKey } },
                    include: { items: true },
                });
                if (existing) return existing;
            }

            const address = await tx.address.findFirst({
                where: { id: addressId, userId: patientId, deletedAt: null },
            });
            if (!address) throw new ApiError(404, 'Delivery address not found');

            const cart = await tx.cart.findUnique({
                where: { userId: patientId },
                include: { items: { include: { product: true } } },
            });
            if (!cart || cart.items.length === 0) {
                throw new ApiError(400, 'Your cart is empty');
            }

            let targetPharmacyId: string;
            if (pharmacyId) {
                const ph = await tx.pharmacy.findUnique({ where: { id: pharmacyId } });
                if (!ph || ph.status !== 'ACTIVE') throw new ApiError(404, 'Active pharmacy not found');
                if (!ph.hasMedicineService) {
                    throw new ApiError(400, 'Selected clinic does not have medicine service enabled');
                }
                targetPharmacyId = ph.id;
            } else {
                const primary = await tx.pharmacy.findFirst({
                    where: { isPrimary: true, status: 'ACTIVE', hasMedicineService: true },
                });
                if (!primary) throw new ApiError(400, 'No active Primary Pharmacy configured');
                targetPharmacyId = primary.id;
            }

            const needsRx = cart.items.some((i) => i.product.requiresPrescription);
            if (needsRx) {
                if (!prescriptionId) {
                    throw new ApiError(400, 'A valid prescriptionId is required for prescription medicines in your cart');
                }
                const rx = await tx.prescription.findFirst({ where: { id: prescriptionId, patientId } });
                if (!rx) throw new ApiError(404, 'Prescription not found');
                if (rx.status === 'REJECTED' || rx.status === 'CANCELLED' || rx.status === 'EXPIRED') {
                    throw new ApiError(400, `Prescription cannot be used in ${rx.status} status`);
                }
            }

            let subtotalPaise = 0;
            const orderItemsData = cart.items.map((item) => {
                const lineTotalPaise = item.product.mrpPaise * item.quantity;
                subtotalPaise += lineTotalPaise;
                return {
                    productId: item.productId,
                    nameSnapshot: item.product.name,
                    quantity: item.quantity,
                    mrpPaise: item.product.mrpPaise,
                    unitPricePaise: item.product.mrpPaise,
                    lineTotalPaise,
                    requiresPrescription: item.product.requiresPrescription,
                };
            });

            // Optional Coupon validation & redemption
            let couponId: string | null = null;
            let discountPaise = 0;

            if (couponCode) {
                const coupon = await tx.coupon.findUnique({ where: { code: couponCode } });
                if (!coupon || !coupon.isActive) throw new ApiError(404, 'Invalid or inactive coupon');

                const now = new Date();
                if (now < coupon.validFrom || now > coupon.validTo) {
                    throw new ApiError(400, 'Coupon is expired or not yet active');
                }
                if (subtotalPaise < coupon.minOrderPaise) {
                    throw new ApiError(400, `Minimum order amount is ${coupon.minOrderPaise} paise`);
                }
                if (coupon.usageLimitTotal !== null && coupon.usedCount >= coupon.usageLimitTotal) {
                    throw new ApiError(400, 'Coupon usage limit reached');
                }

                const perUserLimit = coupon.usageLimitPerUser ?? 1;
                const userUsedCount = await tx.couponRedemption.count({
                    where: { couponId: coupon.id, userId: patientId },
                });
                if (userUsedCount >= perUserLimit) {
                    throw new ApiError(400, `You have already used this coupon ${perUserLimit} time(s)`);
                }

                discountPaise =
                    coupon.discountType === 'PERCENT'
                        ? Math.floor((subtotalPaise * coupon.discountValue) / 100)
                        : coupon.discountValue;

                if (coupon.maxDiscountPaise !== null && discountPaise > coupon.maxDiscountPaise) {
                    discountPaise = coupon.maxDiscountPaise;
                }
                if (discountPaise > subtotalPaise) discountPaise = subtotalPaise;
                couponId = coupon.id;
            }

            const deliveryFeePaise = 0;
            const totalPaise = Math.max(0, subtotalPaise - discountPaise + deliveryFeePaise);
            const orderNumber = `ORD-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

            const order = await tx.order.create({
                data: {
                    orderNumber,
                    patientId,
                    pharmacyId: targetPharmacyId,
                    prescriptionId: prescriptionId ?? null,
                    couponId,
                    addressId: address.id,
                    deliveryAddress: {
                        fullName: address.fullName,
                        phone: address.phone,
                        line1: address.line1,
                        line2: address.line2,
                        landmark: address.landmark,
                        city: address.city,
                        state: address.state,
                        pincode: address.pincode,
                    },
                    status: 'PENDING_PHARMACY_REVIEW',
                    paymentMethod: 'COD',
                    paymentStatus: 'PENDING',
                    subtotalPaise,
                    discountPaise,
                    deliveryFeePaise,
                    totalPaise,
                    idempotencyKey,
                    items: { create: orderItemsData },
                    history: {
                        create: {
                            fromStatus: null,
                            toStatus: 'PENDING_PHARMACY_REVIEW',
                            actorId: actor.id,
                            actorRole: actor.role,
                        },
                    },
                },
                include: { items: true },
            });

            if (couponId) {
                await tx.couponRedemption.create({
                    data: { couponId, userId: patientId, orderId: order.id, discountPaise },
                });
                await tx.coupon.update({
                    where: { id: couponId },
                    data: { usedCount: { increment: 1 } },
                });
            }

            await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

            await tx.auditLog.create({
                data: {
                    actorId: actor.id,
                    actorRole: actor.role,
                    action: 'ORDER_PLACED',
                    entityType: 'Order',
                    entityId: order.id,
                    after: { orderNumber: order.orderNumber, totalPaise, discountPaise, couponId, pharmacyId: targetPharmacyId } as any,
                },
            });

            return order;
        },
        { maxWait: 10000, timeout: 30000 }
    );

export const listPatientOrders = (patientId: string) =>
    prisma.order.findMany({
        where: { patientId },
        orderBy: { placedAt: 'desc' },
        include: { items: true, pharmacy: { select: { id: true, name: true } } },
    });

export const listPharmacyOrders = (pharmacyId: string) =>
    prisma.order.findMany({
        where: { pharmacyId },
        orderBy: { placedAt: 'desc' },
        include: { items: true, patient: { select: { id: true, fullName: true, phone: true } } },
    });

export const transitionOrderStatusTx = (order: any, toStatus: OrderStatus, reason: string | null, actor: Actor) =>
    prisma.$transaction(
        async (tx) => {
            const now = new Date();
            const data: any = { status: toStatus };
            if (toStatus === 'ACCEPTED') data.acceptedAt = now;
            if (toStatus === 'READY_FOR_PICKUP') data.readyAt = now;
            if (toStatus === 'CANCELLED') {
                data.cancelledAt = now;
                data.cancelReason = reason;
            }

            const updated = await tx.order.update({
                where: { id: order.id },
                data,
                include: { items: true },
            });

            await tx.orderStatusHistory.create({
                data: {
                    orderId: order.id,
                    fromStatus: order.status,
                    toStatus,
                    actorId: actor.id,
                    actorRole: actor.role,
                    reason,
                },
            });

            await tx.auditLog.create({
                data: {
                    actorId: actor.id,
                    actorRole: actor.role,
                    action: 'ORDER_STATUS_UPDATED',
                    entityType: 'Order',
                    entityId: order.id,
                    before: { status: order.status } as any,
                    after: { status: updated.status, reason } as any,
                },
            });

            return updated;
        },
        { maxWait: 10000, timeout: 30000 }
    );
