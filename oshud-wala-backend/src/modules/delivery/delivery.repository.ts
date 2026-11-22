import crypto from 'crypto';
import { RoleName } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/apiError';
import { sha256Hex, encryptOtp } from './delivery.crypto';

type Actor = { id: string; role: RoleName };

const RIDER_EARNING_PAISE = Number(process.env.RIDER_EARNING_PAISE || 4000); // ₹40

export const assignOrdersToRiderTx = (riderId: string, orderIds: string[], actor: Actor) =>
    prisma.$transaction(
        async (tx) => {
            const riderProfile = await tx.riderProfile.findUnique({
                where: { userId: riderId },
                include: { user: { select: { id: true, status: true } } },
            });
            if (!riderProfile || riderProfile.user.status !== 'ACTIVE' || riderProfile.status === 'SUSPENDED') {
                throw new ApiError(404, 'Active rider not found');
            }

            const orders = await tx.order.findMany({ where: { id: { in: orderIds } } });
            if (orders.length !== orderIds.length) {
                throw new ApiError(404, 'One or more orders not found');
            }
            for (const o of orders) {
                if (o.status !== 'READY_FOR_PICKUP') {
                    throw new ApiError(400, `Order ${o.orderNumber} is in ${o.status} status, must be READY_FOR_PICKUP`);
                }
            }

            const batch = await tx.deliveryBatch.create({
                data: { riderId, assignedById: actor.id },
            });

            const deliveries = [];
            for (const o of orders) {
                const del = await tx.delivery.create({
                    data: {
                        orderId: o.id,
                        batchId: batch.id,
                        riderId,
                        assignedById: actor.id,
                        status: 'ASSIGNED',
                        history: {
                            create: {
                                fromStatus: null,
                                toStatus: 'ASSIGNED',
                                riderId,
                                actorId: actor.id,
                            },
                        },
                    },
                });
                deliveries.push(del);

                await tx.order.update({ where: { id: o.id }, data: { status: 'RIDER_ASSIGNED' } });
                await tx.orderStatusHistory.create({
                    data: {
                        orderId: o.id,
                        fromStatus: 'READY_FOR_PICKUP',
                        toStatus: 'RIDER_ASSIGNED',
                        actorId: actor.id,
                        actorRole: actor.role,
                    },
                });
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
            }

            await tx.auditLog.create({
                data: {
                    actorId: actor.id,
                    actorRole: actor.role,
                    action: 'DELIVERY_BATCH_ASSIGNED',
                    entityType: 'DeliveryBatch',
                    entityId: batch.id,
                    after: { riderId, orderIds } as any,
                },
            });

            return { batch, deliveries, pickupQrs };
        },
        { maxWait: 10000, timeout: 30000 }
    );

export const listRiderDeliveries = (riderId: string) =>
    prisma.delivery.findMany({
        where: { riderId },
        orderBy: { assignedAt: 'desc' },
        include: {
            order: {
                select: {
                    id: true,
                    orderNumber: true,
                    status: true,
                    totalPaise: true,
                    deliveryAddress: true,
                    pharmacy: { select: { id: true, name: true, line1: true, phone: true } },
                },
            },
        },
    });

export const scanPickupQrTx = (qrToken: string, riderId: string, actor: Actor) =>
    prisma.$transaction(
        async (tx) => {
            const tokenHash = sha256Hex(qrToken);
            const qr = await tx.pickupQr.findUnique({
                where: { tokenHash },
                include: { batch: true },
            });
            if (!qr) throw new ApiError(404, 'Invalid pickup QR');
            if (qr.status !== 'ACTIVE') throw new ApiError(400, `Pickup QR is already ${qr.status}`);
            if (qr.expiresAt < new Date()) throw new ApiError(400, 'Pickup QR has expired');
            if (qr.batch.riderId !== riderId) throw new ApiError(403, 'This pickup QR is assigned to a different rider');

            // Atomically consume single-use QR
            const consumed = await tx.pickupQr.updateMany({
                where: { id: qr.id, status: 'ACTIVE' },
                data: { status: 'USED', usedAt: new Date(), usedByRiderId: riderId },
            });
            if (consumed.count === 0) throw new ApiError(400, 'Pickup QR was already used');

            const deliveries = await tx.delivery.findMany({
                where: { batchId: qr.batchId, order: { pharmacyId: qr.pharmacyId } },
            });

            const now = new Date();
            for (const d of deliveries) {
                await tx.delivery.update({
                    where: { id: d.id },
                    data: { status: 'PICKED_UP', pickedUpAt: now, shippedAt: now },
                });
                await tx.deliveryStatusHistory.create({
                    data: { deliveryId: d.id, fromStatus: d.status, toStatus: 'PICKED_UP', riderId, actorId: actor.id },
                });
                await tx.order.update({ where: { id: d.orderId }, data: { status: 'SHIPPED' } });
                await tx.orderStatusHistory.create({
                    data: { orderId: d.orderId, fromStatus: 'RIDER_ASSIGNED', toStatus: 'SHIPPED', actorId: actor.id, actorRole: actor.role },
                });
            }

            return { batchId: qr.batchId, pickedUpCount: deliveries.length };
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
