import crypto from 'crypto';
import { RoleName } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/apiError';
import { sha256Hex, encryptOtp } from './delivery.crypto';

type Actor = { id: string; role: RoleName };

const RIDER_EARNING_PAISE = Number(process.env.RIDER_EARNING_PAISE || 4000); // ₹40

interface ActivePickupQrInfo {
    qrToken: string;
    expiresAt: Date;
    batchId: string;
    pharmacyId: string;
    riderId: string;
    orderIds: string[];
}
const activePickupQrCache = new Map<string, ActivePickupQrInfo>();

const isUuid = (val: any): boolean =>
    typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);

export const assignOrdersToRiderTx = (riderId: string, orderIds: string[], actor: Actor) =>
    prisma.$transaction(
        async (tx) => {
            let riderProfile: any = null;
            if (isUuid(riderId)) {
                riderProfile = await tx.riderProfile.findFirst({
                    where: { OR: [{ userId: riderId }, { id: riderId }] },
                    include: { user: { select: { id: true, status: true, fullName: true, phone: true, email: true } } },
                });
            } else {
                const cleanPhone = riderId.replace(/[^0-9]/g, '');
                riderProfile = await tx.riderProfile.findFirst({
                    where: {
                        OR: [
                            ...(cleanPhone ? [{ user: { phone: { contains: cleanPhone.slice(-10) } } }] : []),
                            { user: { email: riderId } },
                        ],
                    },
                    include: { user: { select: { id: true, status: true, fullName: true, phone: true, email: true } } },
                });
                if (!riderProfile) {
                    riderProfile = await tx.riderProfile.findFirst({
                        where: { user: { status: 'ACTIVE' } },
                        include: { user: { select: { id: true, status: true, fullName: true, phone: true, email: true } } },
                    });
                }
            }

            if (!riderProfile || riderProfile.user.status !== 'ACTIVE' || riderProfile.status === 'SUSPENDED') {
                throw new ApiError(404, 'Active rider not found');
            }
            const targetUserId = riderProfile.userId;

            const uuidOrderIds = orderIds.filter((id) => isUuid(id));
            const nonUuidOrderIds = orderIds.filter((id) => !isUuid(id));

            const orders = await tx.order.findMany({
                where: {
                    OR: [
                        ...(uuidOrderIds.length > 0 ? [{ id: { in: uuidOrderIds } }] : []),
                        ...(nonUuidOrderIds.length > 0 ? [{ orderNumber: { in: nonUuidOrderIds } }] : []),
                    ],
                },
            });

            if (orders.length === 0) {
                throw new ApiError(404, 'One or more orders not found');
            }

            for (const o of orders) {
                if (['CANCELLED', 'REJECTED', 'DELIVERED', 'SHIPPED'].includes(o.status)) {
                    throw new ApiError(400, `Order ${o.orderNumber || o.id} is in ${o.status} status and cannot be assigned`);
                }
            }

            const batch = await tx.deliveryBatch.create({
                data: { riderId: targetUserId, assignedById: actor.id },
            });

            const deliveries = [];
            for (const o of orders) {
                const existingDel = await tx.delivery.findUnique({ where: { orderId: o.id } });
                let del;
                if (existingDel) {
                    del = await tx.delivery.update({
                        where: { id: existingDel.id },
                        data: {
                            batchId: batch.id,
                            riderId: targetUserId,
                            assignedById: actor.id,
                            status: 'ASSIGNED',
                        },
                    });
                    await tx.deliveryStatusHistory.create({
                        data: {
                            deliveryId: existingDel.id,
                            fromStatus: existingDel.status,
                            toStatus: 'ASSIGNED',
                            riderId: targetUserId,
                            actorId: actor.id,
                        },
                    });
                } else {
                    del = await tx.delivery.create({
                        data: {
                            orderId: o.id,
                            batchId: batch.id,
                            riderId: targetUserId,
                            assignedById: actor.id,
                            status: 'ASSIGNED',
                            history: {
                                create: {
                                    fromStatus: null,
                                    toStatus: 'ASSIGNED',
                                    riderId: targetUserId,
                                    actorId: actor.id,
                                },
                            },
                        },
                    });
                }
                deliveries.push(del);

                await tx.order.update({ where: { id: o.id }, data: { status: 'RIDER_ASSIGNED' } });
                await tx.orderStatusHistory.create({
                    data: {
                        orderId: o.id,
                        fromStatus: o.status,
                        toStatus: 'RIDER_ASSIGNED',
                        actorId: actor.id,
                        actorRole: actor.role,
                    },
                });

                // In-app notification for the assigned Rider
                await tx.notification.create({
                    data: {
                        userId: targetUserId,
                        category: 'DELIVERY',
                        eventType: 'ORDER_ASSIGNED_TO_RIDER',
                        title: 'New Order Delivery Assigned',
                        body: `Order ${o.orderNumber || o.id} assigned to you. Single-use pickup QR is ready at pharmacy counter.`,
                        data: { link: '/rider/deliveries', orderId: o.id },
                        priority: 'HIGH',
                        dedupeKey: `notif_assign_${o.id}_${targetUserId}_${Date.now()}`,
                    },
                }).catch(() => {});

                // Original in-app notification for Patient
                if (o.patientId) {
                    await tx.notification.create({
                        data: {
                            userId: o.patientId,
                            category: 'DELIVERY',
                            eventType: 'RIDER_ASSIGNED_TO_ORDER',
                            title: 'Rider Assigned to Your Order',
                            body: `A delivery rider has been assigned to order ${o.orderNumber || o.id}.`,
                            data: { link: '/orders', orderId: o.id },
                            priority: 'NORMAL',
                            dedupeKey: `notif_pat_assign_${o.id}_${Date.now()}`,
                        },
                    }).catch(() => {});
                }
            }

            // Generate one single-use Pickup QR per unique pharmacy in this batch
            const uniquePharmacyIds = Array.from(new Set(orders.map((o) => o.pharmacyId)));
            const pickupQrs: Array<{ id: string; pharmacyId: string; qrToken: string; expiresAt: Date }> = [];
            const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours

            for (const pharmacyId of uniquePharmacyIds) {
                const rawToken = `QR-${batch.id}-${crypto.randomBytes(16).toString('hex')}`;
                const qr = await tx.pickupQr.create({
                    data: {
                        batchId: batch.id,
                        pharmacyId,
                        tokenHash: sha256Hex(rawToken),
                        status: 'ACTIVE',
                        expiresAt,
                    },
                });
                pickupQrs.push({ id: qr.id, pharmacyId, qrToken: rawToken, expiresAt });

                // Cache active pickup QR by order IDs, batch ID, and token for instant retrieval
                const qrInfo: ActivePickupQrInfo = {
                    qrToken: rawToken,
                    expiresAt,
                    batchId: batch.id,
                    pharmacyId,
                    riderId: targetUserId,
                    orderIds: orders.map((o) => o.id),
                };
                for (const o of orders) {
                    activePickupQrCache.set(o.id, qrInfo);
                    if (o.orderNumber) activePickupQrCache.set(o.orderNumber, qrInfo);
                }
                activePickupQrCache.set(batch.id, qrInfo);
                activePickupQrCache.set(rawToken, qrInfo);
            }

            await tx.auditLog.create({
                data: {
                    actorId: actor.id,
                    actorRole: actor.role,
                    action: 'DELIVERY_BATCH_ASSIGNED',
                    entityType: 'DeliveryBatch',
                    entityId: batch.id,
                    after: { riderId: targetUserId, orderIds: orders.map((o) => o.id) } as any,
                },
            });

            return { batch, deliveries, pickupQrs };
        },
        { maxWait: 10000, timeout: 30000 }
    );

export const listRiderDeliveries = async (riderId: string, actor?: Actor) => {
    let targetUserId: string | null = null;
    let profile: any = null;

    if (isUuid(riderId)) {
        profile = await prisma.riderProfile.findFirst({
            where: { OR: [{ userId: riderId }, { id: riderId }] },
        });
        targetUserId = profile?.userId || riderId;
    } else {
        const cleanPhone = (riderId || '').replace(/[^0-9]/g, '');
        profile = await prisma.riderProfile.findFirst({
            where: {
                OR: [
                    ...(cleanPhone ? [{ user: { phone: { contains: cleanPhone.slice(-10) } } }] : []),
                    { user: { email: riderId } },
                ],
            },
        });
        if (profile) {
            targetUserId = profile.userId;
        } else {
            const fallbackProfile = await prisma.riderProfile.findFirst({
                where: { user: { status: 'ACTIVE' } },
            });
            if (fallbackProfile) {
                targetUserId = fallbackProfile.userId;
                profile = fallbackProfile;
            }
        }
    }

    const orClauses: any[] = [];
    if (targetUserId) {
        orClauses.push({ riderId: targetUserId });
        orClauses.push({ batch: { riderId: targetUserId } });
    }
    if (profile?.id) {
        orClauses.push({ riderId: profile.id });
        orClauses.push({ batch: { riderId: profile.id } });
    }
    if (isUuid(riderId)) {
        orClauses.push({ riderId: riderId });
        orClauses.push({ batch: { riderId: riderId } });
    }

    const whereClause: any = orClauses.length > 0 ? { OR: orClauses } : undefined;

    let deliveries = whereClause
        ? await prisma.delivery.findMany({
              where: whereClause,
              orderBy: { assignedAt: 'desc' },
              include: {
                  batch: { include: { pickupQrs: true } },
                  order: {
                      select: {
                          id: true,
                          orderNumber: true,
                          status: true,
                          subtotalPaise: true,
                          deliveryFeePaise: true,
                          totalPaise: true,
                          paymentMethod: true,
                          paymentStatus: true,
                          deliveryAddress: true,
                          items: {
                              select: {
                                  id: true,
                                  nameSnapshot: true,
                                  quantity: true,
                                  mrpPaise: true,
                                  unitPricePaise: true,
                                  lineTotalPaise: true,
                                  requiresPrescription: true,
                              },
                          },
                          pharmacy: { select: { id: true, name: true, line1: true, phone: true } },
                      },
                  },
              },
          })
        : [];

    if (deliveries.length === 0 && actor?.role === 'SUPER_ADMIN') {
        deliveries = await prisma.delivery.findMany({
            where: { status: { in: ['ASSIGNED', 'ACCEPTED', 'PICKED_UP', 'ARRIVED'] as any } },
            orderBy: { assignedAt: 'desc' },
            include: {
                batch: { include: { pickupQrs: true } },
                order: {
                    select: {
                        id: true,
                        orderNumber: true,
                        status: true,
                        subtotalPaise: true,
                        deliveryFeePaise: true,
                        totalPaise: true,
                        paymentMethod: true,
                        paymentStatus: true,
                        deliveryAddress: true,
                        items: {
                            select: {
                                id: true,
                                nameSnapshot: true,
                                quantity: true,
                                mrpPaise: true,
                                unitPricePaise: true,
                                lineTotalPaise: true,
                                requiresPrescription: true,
                            },
                        },
                        pharmacy: { select: { id: true, name: true, line1: true, phone: true } },
                    },
                },
            },
        });
    }

    return deliveries;
};

export const getOrderPickupQr = async (orderId: string, actor: Actor) => {
    const order = await prisma.order.findFirst({
        where: isUuid(orderId) ? { OR: [{ id: orderId }, { orderNumber: orderId }] } : { orderNumber: orderId },
        include: {
            items: true,
            delivery: {
                include: {
                    rider: {
                        select: { id: true, fullName: true, phone: true },
                    },
                    batch: true,
                },
            },
        },
    });

    if (!order) {
        throw new ApiError(404, 'Order not found');
    }

    if (!order.delivery || !order.delivery.riderId) {
        throw new ApiError(400, 'No delivery rider has been assigned by Admin to this order yet. Authentic QR code can only be generated after rider assignment.');
    }

    let cached = activePickupQrCache.get(order.id);
    if (!cached && order.orderNumber) {
        cached = activePickupQrCache.get(order.orderNumber);
    }
    if (!cached && order.delivery?.batchId) {
        cached = activePickupQrCache.get(order.delivery.batchId);
    }

    let token = cached?.qrToken;
    let expiresAt = cached?.expiresAt || new Date(Date.now() + 15 * 60 * 1000);

    if (!token) {
        token = `QR-${order.delivery.batchId || order.id}-${crypto.randomBytes(16).toString('hex')}`;
        const tokenHash = sha256Hex(token);
        expiresAt = new Date(Date.now() + 15 * 60 * 1000);

        if (order.delivery.batchId) {
            const existingQr = await prisma.pickupQr.findFirst({
                where: { batchId: order.delivery.batchId, pharmacyId: order.pharmacyId, status: 'ACTIVE' },
            });
            if (existingQr) {
                await prisma.pickupQr.update({
                    where: { id: existingQr.id },
                    data: { tokenHash, expiresAt },
                });
            } else {
                await prisma.pickupQr.create({
                    data: {
                        batchId: order.delivery.batchId,
                        pharmacyId: order.pharmacyId,
                        tokenHash,
                        status: 'ACTIVE',
                        expiresAt,
                    },
                });
            }
        }

        const qrInfo: ActivePickupQrInfo = {
            qrToken: token,
            expiresAt,
            batchId: order.delivery.batchId || order.id,
            pharmacyId: order.pharmacyId,
            riderId: order.delivery.riderId,
            orderIds: [order.id],
        };
        activePickupQrCache.set(order.id, qrInfo);
        if (order.orderNumber) activePickupQrCache.set(order.orderNumber, qrInfo);
        if (order.delivery.batchId) activePickupQrCache.set(order.delivery.batchId, qrInfo);
        activePickupQrCache.set(token, qrInfo);
    }

    return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        qrToken: token,
        expiresAt,
        durationMinutes: 15,
        assignedRider: (order as any).delivery?.rider
            ? {
                  id: (order as any).delivery.rider.id,
                  name: (order as any).delivery.rider.fullName || (order as any).delivery.rider.name || 'Assigned Rider',
                  phone: (order as any).delivery.rider.phone,
              }
            : null,
        items: order.items.map((i) => ({
            name: i.nameSnapshot,
            quantity: i.quantity,
            mrpPaise: i.mrpPaise,
        })),
    };
};

export const scanPickupQrTx = (qrToken: string, riderId: string, actor: Actor) =>
    prisma.$transaction(
        async (tx) => {
            let cleanToken = (qrToken || '').trim();
            let extractedOrderId: string | null = null;
            try {
                const parsed = JSON.parse(qrToken);
                if (parsed.qrToken) cleanToken = String(parsed.qrToken).trim();
                else if (parsed.token) cleanToken = String(parsed.token).trim();
                if (parsed.orderId) extractedOrderId = String(parsed.orderId).trim();
            } catch {}

            let riderProfile: any = null;
            if (isUuid(riderId)) {
                riderProfile = await tx.riderProfile.findFirst({
                    where: { OR: [{ userId: riderId }, { id: riderId }] },
                });
            } else {
                const cleanPhone = (riderId || '').replace(/[^0-9]/g, '');
                riderProfile = await tx.riderProfile.findFirst({
                    where: {
                        OR: [
                            ...(cleanPhone ? [{ user: { phone: { contains: cleanPhone.slice(-10) } } }] : []),
                            { user: { email: riderId } },
                        ],
                    },
                });
                if (!riderProfile) {
                    riderProfile = await tx.riderProfile.findFirst({
                        where: { user: { status: 'ACTIVE' } },
                    });
                }
            }
            const actualUserId = riderProfile?.userId || (isUuid(riderId) ? riderId : null);

            const tokenHash = sha256Hex(cleanToken);
            let qr = await tx.pickupQr.findUnique({
                where: { tokenHash },
                include: { batch: true },
            });

            const cached = activePickupQrCache.get(cleanToken) || (extractedOrderId ? activePickupQrCache.get(extractedOrderId) : undefined);

            if (!qr && !cached) {
                // Check if cleanToken is directly an order ID, orderNumber, or batch ID
                const orderMatch = await tx.order.findFirst({
                    where: isUuid(cleanToken) ? { OR: [{ id: cleanToken }, { orderNumber: cleanToken }] } : { orderNumber: cleanToken },
                    include: { delivery: true },
                });
                if (orderMatch && orderMatch.delivery?.batchId) {
                    qr = await tx.pickupQr.findFirst({
                        where: { batchId: orderMatch.delivery.batchId, status: 'ACTIVE' },
                        include: { batch: true },
                    });
                }
            }

            if (!qr && !cached) {
                throw new ApiError(404, 'Invalid pickup QR. No matching parcel found.');
            }

            if (qr) {
                if (qr.status !== 'ACTIVE') throw new ApiError(400, `Pickup QR is already ${qr.status}`);
                if (qr.expiresAt < new Date()) throw new ApiError(400, 'Pickup QR has expired');

                // Strictly authenticate rider
                const designatedRiderId = qr.batch.riderId;
                const isAuthorized =
                    designatedRiderId === riderId ||
                    (actualUserId && designatedRiderId === actualUserId) ||
                    (riderProfile && designatedRiderId === riderProfile.id);
                if (!isAuthorized) {
                    throw new ApiError(403, 'Verification Denied: This pickup QR code is assigned to a different delivery partner. You do not have permission to verify or view this order.');
                }

                // Atomically consume single-use QR
                const consumed = await tx.pickupQr.updateMany({
                    where: { id: qr.id, status: 'ACTIVE' },
                    data: { status: 'USED', usedAt: new Date(), ...(actualUserId ? { usedByRiderId: actualUserId } : {}) },
                });
                if (consumed.count === 0) throw new ApiError(400, 'Pickup QR was already used');
                if (consumed.count === 0) throw new ApiError(400, 'Pickup QR was already used');

                const deliveries = await tx.delivery.findMany({
                    where: { batchId: qr.batchId, order: { pharmacyId: qr.pharmacyId } },
                    include: {
                        order: {
                            include: {
                                items: true,
                                pharmacy: { select: { id: true, name: true, phone: true, line1: true } },
                                patient: { select: { fullName: true, phone: true } },
                            },
                        },
                    },
                });

                const now = new Date();
                for (const d of deliveries) {
                    await tx.delivery.update({
                        where: { id: d.id },
                        data: { status: 'PICKED_UP', pickedUpAt: now, shippedAt: now },
                    });
                    await tx.deliveryStatusHistory.create({
                        data: { deliveryId: d.id, fromStatus: d.status, toStatus: 'PICKED_UP', riderId: actualUserId, actorId: actor.id },
                    });
                    await tx.order.update({ where: { id: d.orderId }, data: { status: 'SHIPPED' } });
                    await tx.orderStatusHistory.create({
                        data: { orderId: d.orderId, fromStatus: 'RIDER_ASSIGNED', toStatus: 'SHIPPED', actorId: actor.id, actorRole: actor.role },
                    });
                }

                activePickupQrCache.delete(cleanToken);
                activePickupQrCache.delete(qrToken);

                return {
                    success: true,
                    verified: true,
                    batchId: qr.batchId,
                    pickedUpCount: deliveries.length,
                    orders: deliveries.map((d) => ({
                        id: d.order.id,
                        orderNumber: d.order.orderNumber,
                        status: 'OUT_FOR_DELIVERY',
                        totalAmount: Number(d.order.totalPaise || 0) / 100,
                        paymentMethod: d.order.paymentMethod,
                        paymentStatus: d.order.paymentStatus,
                        customerName: (d.order.deliveryAddress as any)?.fullName || d.order.patient?.fullName || 'Customer',
                        customerPhone: (d.order.deliveryAddress as any)?.phone || d.order.patient?.phone || '',
                        deliveryAddress: [(d.order.deliveryAddress as any)?.line1, (d.order.deliveryAddress as any)?.area, (d.order.deliveryAddress as any)?.city, (d.order.deliveryAddress as any)?.pincode].filter(Boolean).join(', '),
                        area: (d.order.deliveryAddress as any)?.area || 'Kolkata Central',
                        pharmacyName: d.order.pharmacy?.name || 'Fulfillment Pharmacy',
                        pharmacyPhone: d.order.pharmacy?.phone || '',
                        pharmacyAddress: d.order.pharmacy?.line1 || 'Dispensary Hub',
                        items: d.order.items.map((it) => ({
                            id: it.id,
                            name: it.nameSnapshot,
                            quantity: it.quantity,
                            unitPrice: Number(it.unitPricePaise || it.mrpPaise || 0) / 100,
                            lineTotal: Number(it.lineTotalPaise || 0) / 100,
                            requiresPrescription: it.requiresPrescription,
                        })),
                    })),
                };
            }

            // Fallback for cache-matched token
            if (cached) {
                if (cached.expiresAt < new Date()) throw new ApiError(400, 'Pickup QR has expired');
                const isAuthorized = !cached.riderId || cached.riderId === riderId || cached.riderId === actualUserId || cached.riderId === riderProfile?.id;
                if (!isAuthorized) {
                    throw new ApiError(403, 'Verification Denied: This pickup QR code is assigned to a different delivery partner. You do not have permission to verify or view this order.');
                }

                const now = new Date();
                const updatedOrders: any[] = [];
                for (const oId of cached.orderIds) {
                    const ord = await tx.order.update({
                        where: { id: oId },
                        data: { status: 'SHIPPED' },
                        include: {
                            items: true,
                            pharmacy: { select: { id: true, name: true, phone: true, line1: true } },
                            patient: { select: { fullName: true, phone: true } },
                        },
                    }).catch(() => null);

                    await tx.delivery.updateMany({
                        where: { orderId: oId },
                        data: { status: 'PICKED_UP', pickedUpAt: now, shippedAt: now },
                    }).catch(() => {});

                    if (ord) updatedOrders.push(ord);
                }

                activePickupQrCache.delete(cleanToken);
                activePickupQrCache.delete(qrToken);

                return {
                    success: true,
                    verified: true,
                    batchId: cached.batchId,
                    pickedUpCount: updatedOrders.length,
                    orders: updatedOrders.map((o: any) => ({
                        id: o.id,
                        orderNumber: o.orderNumber,
                        status: 'OUT_FOR_DELIVERY',
                        totalAmount: Number(o.totalPaise || 0) / 100,
                        paymentMethod: o.paymentMethod,
                        paymentStatus: o.paymentStatus,
                        customerName: (o.deliveryAddress as any)?.fullName || o.patient?.fullName || 'Customer',
                        customerPhone: (o.deliveryAddress as any)?.phone || o.patient?.phone || '',
                        deliveryAddress: [(o.deliveryAddress as any)?.line1, (o.deliveryAddress as any)?.area, (o.deliveryAddress as any)?.city, (o.deliveryAddress as any)?.pincode].filter(Boolean).join(', '),
                        area: (o.deliveryAddress as any)?.area || 'Kolkata Central',
                        pharmacyName: o.pharmacy?.name || 'Fulfillment Pharmacy',
                        pharmacyPhone: o.pharmacy?.phone || '',
                        pharmacyAddress: o.pharmacy?.line1 || 'Dispensary Hub',
                        items: (o.items || []).map((it: any) => ({
                            id: it.id,
                            name: it.nameSnapshot,
                            quantity: it.quantity,
                            unitPrice: Number(it.unitPricePaise || it.mrpPaise || 0) / 100,
                            lineTotal: Number(it.lineTotalPaise || 0) / 100,
                            requiresPrescription: it.requiresPrescription,
                        })),
                    })),
                };
            }

            throw new ApiError(404, 'Invalid pickup QR');
        },
        { maxWait: 10000, timeout: 30000 }
    );

export const markArrivedAndGenerateOtpTx = (deliveryId: string, riderId: string, actor: Actor) =>
    prisma.$transaction(
        async (tx) => {
            const delivery = await tx.delivery.findUnique({
                where: { id: deliveryId },
                include: { order: true },
            });
            if (!delivery) throw new ApiError(404, 'Delivery not found');
            if (delivery.riderId !== riderId) throw new ApiError(403, 'This delivery is not assigned to you');
            if (delivery.status !== 'PICKED_UP' && delivery.status !== 'IN_TRANSIT' && delivery.status !== 'ARRIVED') {
                throw new ApiError(400, `Cannot mark arrived from ${delivery.status} status`);
            }

            // Supersede any old active OTPs
            await tx.deliveryOtp.updateMany({
                where: { deliveryId: delivery.id, status: 'ACTIVE' },
                data: { status: 'SUPERSEDED' },
            });

            const otp = String(crypto.randomInt(100000, 1000000));
            const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

            await tx.deliveryOtp.create({
                data: {
                    orderId: delivery.orderId,
                    deliveryId: delivery.id,
                    customerId: delivery.order.patientId,
                    riderId,
                    otpHash: sha256Hex(`${delivery.id}:${otp}`),
                    otpCiphertext: encryptOtp(otp),
                    status: 'ACTIVE',
                    attempts: 0,
                    maxAttempts: 5,
                    expiresAt,
                },
            });

            const updated = await tx.delivery.update({
                where: { id: delivery.id },
                data: { status: 'ARRIVED', arrivedAt: new Date() },
            });

            await tx.deliveryStatusHistory.create({
                data: { deliveryId: delivery.id, fromStatus: delivery.status, toStatus: 'ARRIVED', riderId, actorId: actor.id },
            });

            // Never expose OTP to rider
            return { deliveryId: updated.id, status: updated.status, otpExpiresAt: expiresAt };
        },
        { maxWait: 10000, timeout: 30000 }
    );

export const findActiveCustomerDeliveryOtp = (orderId: string, customerId: string) =>
    prisma.deliveryOtp.findFirst({
        where: { orderId, customerId, status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
    });

export const completeDeliveryWithOtpTx = (deliveryId: string, riderId: string, otp: string, actor: Actor) =>
    prisma.$transaction(
        async (tx) => {
            const delivery = await tx.delivery.findUnique({
                where: { id: deliveryId },
                include: { order: true },
            });
            if (!delivery) throw new ApiError(404, 'Delivery not found');
            if (delivery.riderId !== riderId) throw new ApiError(403, 'This delivery is not assigned to you');
            if (delivery.status === 'DELIVERED') throw new ApiError(400, 'Delivery is already completed');
            if (delivery.status !== 'ARRIVED') throw new ApiError(400, 'Mark arrived before completing delivery');

            const otpRecord = await tx.deliveryOtp.findFirst({
                where: { deliveryId: delivery.id, status: 'ACTIVE' },
                orderBy: { createdAt: 'desc' },
            });
            if (!otpRecord) throw new ApiError(400, 'No active delivery OTP found');
            if (otpRecord.expiresAt < new Date()) {
                await tx.deliveryOtp.update({ where: { id: otpRecord.id }, data: { status: 'EXPIRED' } });
                throw new ApiError(400, 'Delivery OTP has expired');
            }
            if (otpRecord.attempts >= otpRecord.maxAttempts) {
                await tx.deliveryOtp.update({ where: { id: otpRecord.id }, data: { status: 'LOCKED' } });
                throw new ApiError(400, 'Delivery OTP locked due to too many failed attempts');
            }

            const incomingHash = sha256Hex(`${delivery.id}:${otp}`);
            if (incomingHash !== otpRecord.otpHash) {
                const nextAttempts = otpRecord.attempts + 1;
                await tx.deliveryOtp.update({
                    where: { id: otpRecord.id },
                    data: { attempts: nextAttempts, status: nextAttempts >= otpRecord.maxAttempts ? 'LOCKED' : 'ACTIVE' },
                });
                throw new ApiError(400, 'Invalid delivery OTP');
            }

            const now = new Date();
            await tx.deliveryOtp.update({
                where: { id: otpRecord.id },
                data: { status: 'VERIFIED', verifiedAt: now },
            });

            const completedDelivery = await tx.delivery.update({
                where: { id: delivery.id },
                data: { status: 'DELIVERED', deliveredAt: now, riderEarningPaise: RIDER_EARNING_PAISE },
            });

            await tx.deliveryStatusHistory.create({
                data: { deliveryId: delivery.id, fromStatus: 'ARRIVED', toStatus: 'DELIVERED', riderId, actorId: actor.id },
            });

            await tx.order.update({
                where: { id: delivery.orderId },
                data: { status: 'DELIVERED', paymentStatus: 'COLLECTED', deliveredAt: now },
            });

            await tx.orderStatusHistory.create({
                data: { orderId: delivery.orderId, fromStatus: delivery.order.status, toStatus: 'DELIVERED', actorId: actor.id, actorRole: actor.role },
            });

            // 1. Track COD Cash Collection separately (NOT rider earning)
            await tx.cashCollection.create({
                data: {
                    orderId: delivery.orderId,
                    riderId,
                    amountPaise: delivery.order.totalPaise,
                    status: 'COLLECTED',
                    collectedAt: now,
                },
            });

            // 2. Credit Rider Wallet ₹40 (4000 paise) exactly once via immutable ledger
            const wallet = await tx.wallet.upsert({
                where: { ownerKey: `RIDER:${riderId}` },
                create: { ownerKey: `RIDER:${riderId}`, ownerType: 'RIDER', userId: riderId, balancePaise: BigInt(0), heldPaise: BigInt(0) },
                update: {},
            });

            const earningBig = BigInt(RIDER_EARNING_PAISE);
            const newBalance = wallet.balancePaise + earningBig;

            await tx.wallet.update({
                where: { id: wallet.id },
                data: { balancePaise: newBalance, version: { increment: 1 } },
            });

            const ledgerTx = await tx.ledgerTransaction.create({
                data: {
                    txType: 'RIDER_EARNING',
                    referenceType: 'ORDER',
                    referenceId: delivery.orderId,
                    idempotencyKey: `RIDER_EARNING:${delivery.orderId}`,
                    description: `Delivery earning for order ${delivery.order.orderNumber}`,
                    createdBy: actor.id,
                },
            });

            await tx.ledgerEntry.create({
                data: {
                    transactionId: ledgerTx.id,
                    walletId: wallet.id,
                    entryType: 'CREDIT',
                    amountPaise: earningBig,
                    balanceAfterPaise: newBalance,
                    heldAfterPaise: wallet.heldPaise,
                },
            });

            return {
                deliveryId: completedDelivery.id,
                orderId: delivery.orderId,
                status: 'DELIVERED',
                riderEarningPaise: RIDER_EARNING_PAISE,
                codCollectedPaise: delivery.order.totalPaise,
                walletBalancePaise: newBalance.toString(),
            };
        },
        { maxWait: 10000, timeout: 30000 }
    );
