import crypto from 'crypto';
import { OrderStatus, RoleName } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/apiError';
import { decryptOtp } from '../delivery/delivery.crypto';

const isUuid = (val: any): boolean =>
    typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);

type Actor = { id: string; role: RoleName };

export const findActiveOwnerLink = (userId: string, pharmacyId: string) =>
    prisma.pharmacyStaff.findFirst({ where: { userId, pharmacyId, isActive: true } });

export const findPrimaryPharmacy = () =>
    prisma.pharmacy.findFirst({ where: { isPrimary: true, status: 'ACTIVE' } });

export const findOrderById = (id: string) =>
    prisma.order.findUnique({ where: { id }, include: { items: true } });

export const findOrderWithDetails = (id: string) =>
    prisma.order.findUnique({
        where: { id },
        include: {
            items: { include: { product: true } },
            pharmacy: true,
            patient: { select: { id: true, fullName: true, phone: true, email: true } },
            prescription: true,
        },
    });

export const placeOrderFromCartTx = (
    patientId: string,
    addressId: string,
    pharmacyId: string | null,
    prescriptionId: string | null,
    couponCode: string | null,
    idempotencyKey: string | null,
    actor: Actor,
    passedItems: any = null
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

            let cart = await tx.cart.findUnique({
                where: { userId: patientId },
                include: { items: { include: { product: true } } },
            });

            // If cart is empty in DB but items were passed in checkout request, recover/sync cart items
            if ((!cart || cart.items.length === 0) && passedItems && Array.isArray(passedItems) && passedItems.length > 0) {
                if (!cart) {
                    cart = await tx.cart.create({
                        data: { userId: patientId },
                        include: { items: { include: { product: true } } },
                    });
                }
                for (const it of passedItems) {
                    const pid = it.productId || it.id;
                    if (pid) {
                        const prod = await tx.product.findUnique({ where: { id: pid } });
                        if (prod && prod.isActive) {
                            await tx.cartItem.upsert({
                                where: { cartId_productId: { cartId: cart.id, productId: pid } },
                                update: { quantity: Number(it.quantity || it.qty || 1) },
                                create: { cartId: cart.id, productId: pid, quantity: Number(it.quantity || it.qty || 1) },
                            });
                        }
                    }
                }
                cart = await tx.cart.findUnique({
                    where: { id: cart.id },
                    include: { items: { include: { product: true } } },
                });
            }

            if (!cart || cart.items.length === 0) {
                throw new ApiError(400, 'Your cart is empty');
            }

            // All cart & shop orders route exclusively to the Primary Pharmacy
            const primary = await tx.pharmacy.findFirst({
                where: { isPrimary: true, status: 'ACTIVE' },
            }) || await tx.pharmacy.findFirst({
                where: { status: 'ACTIVE', hasMedicineService: true },
            });
            if (!primary) throw new ApiError(400, 'No active Primary Pharmacy configured');
            const targetPharmacyId = primary.id;

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

            // Strict Coupon validation & redemption criteria checking
            let couponId: string | null = null;
            let discountPaise = 0;

            if (couponCode) {
                const cleanCode = String(couponCode).trim().toUpperCase();
                const coupon = await tx.coupon.findUnique({ where: { code: cleanCode } });
                if (!coupon || !coupon.isActive) {
                    throw new ApiError(404, `Coupon "${cleanCode}" is invalid or inactive`);
                }

                const now = new Date();
                if (now < coupon.validFrom) {
                    const fromStr = coupon.validFrom.toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                    });
                    throw new ApiError(400, `Coupon "${coupon.code}" is not active yet. Valid starting ${fromStr}`);
                }
                if (now > coupon.validTo) {
                    const toStr = coupon.validTo.toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                    });
                    throw new ApiError(400, `Coupon "${coupon.code}" has expired on ${toStr}`);
                }
                if (subtotalPaise < coupon.minOrderPaise) {
                    const minRs = Math.round(coupon.minOrderPaise / 100);
                    const currRs = Math.round(subtotalPaise / 100);
                    throw new ApiError(
                        400,
                        `Minimum order amount of ₹${minRs} required for coupon "${coupon.code}" (Your order: ₹${currRs})`
                    );
                }
                if (coupon.usageLimitTotal !== null && coupon.usedCount >= coupon.usageLimitTotal) {
                    throw new ApiError(400, `Coupon "${coupon.code}" has reached its maximum total usage limit`);
                }

                const perUserLimit = coupon.usageLimitPerUser ?? 1;
                const userUsedCount = await tx.couponRedemption.count({
                    where: { couponId: coupon.id, userId: patientId },
                });
                if (userUsedCount >= perUserLimit) {
                    throw new ApiError(
                        400,
                        `You have already used coupon "${coupon.code}" the maximum allowed ${perUserLimit} time(s)`
                    );
                }

                discountPaise =
                    coupon.discountType === 'PERCENT'
                        ? Math.round((subtotalPaise * coupon.discountValue) / 100)
                        : coupon.discountValue;

                if (coupon.maxDiscountPaise !== null && discountPaise > coupon.maxDiscountPaise) {
                    discountPaise = coupon.maxDiscountPaise;
                }
                if (discountPaise > subtotalPaise) discountPaise = subtotalPaise;
                couponId = coupon.id;
            }

            // Delivery fee rule: Below ₹499 is ₹30 (3000 paise), ₹499+ is FREE (0 paise)
            const deliveryFeePaise = subtotalPaise < 49900 ? 3000 : 0;
            const totalPaise = Math.max(0, subtotalPaise - discountPaise + deliveryFeePaise);
            const orderNumber = `ORD-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
            const deliveryOtp = String(crypto.randomInt(1000, 10000));

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
                        deliveryOtp,
                    },
                    status: 'PENDING_PHARMACY_REVIEW',
                    paymentMethod: 'COD',
                    paymentStatus: 'PENDING',
                    subtotalPaise,
                    couponDiscountPaise: discountPaise,
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

            if (prescriptionId) {
                try {
                    await tx.prescription.update({
                        where: { id: prescriptionId },
                        data: {
                            status: 'VERIFIED',
                            verifiedById: actor.id,
                            verifiedAt: new Date(),
                        },
                    });
                } catch {}
            }

            return {
                ...order,
                deliveryOtp,
                total: Number(order.totalPaise || 0) / 100,
                subtotal: Number(order.subtotalPaise || 0) / 100,
            };
        },
        { maxWait: 10000, timeout: 30000 }
    );

export const listPatientOrders = async (patientId: string) => {
    let userPhone: string | null = null;
    if (isUuid(patientId)) {
        const user = await prisma.user.findUnique({ where: { id: patientId } });
        if (user?.phone) userPhone = user.phone.replace(/[^0-9]/g, '');
    }

    const whereClause: any = isUuid(patientId)
        ? {
              OR: [
                  { patientId },
                  ...(userPhone ? [{ patient: { phone: { contains: userPhone.slice(-10) } } }] : []),
                  ...(userPhone ? [{ deliveryAddress: { path: ['phone'], string_contains: userPhone.slice(-10) } }] : []),
              ],
          }
        : userPhone
        ? {
              OR: [
                  { patient: { phone: { contains: userPhone.slice(-10) } } },
                  { deliveryAddress: { path: ['phone'], string_contains: userPhone.slice(-10) } },
              ],
          }
        : {};

    const orders = await prisma.order.findMany({
        where: whereClause,
        orderBy: { placedAt: 'desc' },
        include: {
            items: { include: { product: true } },
            pharmacy: { select: { id: true, name: true, phone: true, line1: true, city: true } },
            patient: { select: { id: true, fullName: true, phone: true } },
            delivery: {
                include: {
                    rider: { select: { id: true, fullName: true, phone: true } },
                },
            },
            deliveryOtps: {
                where: { status: 'ACTIVE' },
                orderBy: { createdAt: 'desc' },
                take: 1,
            },
        },
    });

    return orders.map((o) => {
        let otp = (o.deliveryAddress as any)?.deliveryOtp;
        if (!otp && o.deliveryOtps && o.deliveryOtps.length > 0) {
            try {
                otp = decryptOtp(o.deliveryOtps[0].otpCiphertext);
            } catch (e) {}
        }
        if (!otp) {
            const hashNum = parseInt(crypto.createHash('md5').update(o.id || o.orderNumber).digest('hex').slice(0, 4), 16);
            otp = String(1000 + (hashNum % 9000));
        }

        // Persist the computed OTP to deliveryAddress if not yet saved
        if (!(o.deliveryAddress as any)?.deliveryOtp) {
            prisma.order.update({
                where: { id: o.id },
                data: {
                    deliveryAddress: {
                        ...((o.deliveryAddress as any) || {}),
                        deliveryOtp: otp,
                    },
                },
            }).catch(() => {});
        }

        const subtotal = Number(o.subtotalPaise || 0) / 100;
        const total = Number(o.totalPaise || 0) / 100;
        const deliveryFee = Number(o.deliveryFeePaise || 0) / 100;
        const addr = (o.deliveryAddress as any) || {};

        return {
            id: o.orderNumber || o.id,
            backendId: o.id,
            orderNumber: o.orderNumber,
            status: o.status,
            placedAt: o.placedAt,
            createdAt: o.placedAt,
            total,
            subtotal,
            deliveryFee,
            totalPaise: o.totalPaise,
            subtotalPaise: o.subtotalPaise,
            paymentMethod: (addr as any)?.paymentMethod || o.paymentMethod || 'COD',
            paymentStatus: o.paymentStatus,
            deliveryOtp: otp,
            customerName: addr.fullName || o.patient?.fullName || 'Customer',
            customerPhone: addr.phone || o.patient?.phone || '',
            address: [addr.line1, addr.area, addr.city, addr.pincode].filter(Boolean).join(', ') || addr.line1 || 'Saved Address',
            area: addr.area || '',
            landmark: addr.landmark || '',
            pharmacy: o.pharmacy,
            pharmacyName: o.pharmacy?.name || 'Licensed Partner Pharmacy',
            pharmacyAddress: [(o.pharmacy as any)?.line1, (o.pharmacy as any)?.city].filter(Boolean).join(', ') || 'Dispensary Hub',
            pharmacyPhone: o.pharmacy?.phone || '',
            rider: o.delivery?.rider
                ? {
                      id: o.delivery.rider.id,
                      name: o.delivery.rider.fullName,
                      phone: o.delivery.rider.phone,
                      vehicle: 'Express Delivery Partner',
                  }
                : null,
            assignedRider: o.delivery?.rider
                ? {
                      id: o.delivery.rider.id,
                      name: o.delivery.rider.fullName,
                      phone: o.delivery.rider.phone,
                      vehicle: 'Express Delivery Partner',
                  }
                : null,
            items: o.items.map((it: any) => ({
                id: it.id,
                name: it.nameSnapshot || it.product?.name || 'Prescription Medicine',
                quantity: it.quantity,
                qty: it.quantity,
                price: Number(it.unitPricePaise || it.mrpPaise || 0) / 100,
                unitPrice: Number(it.unitPricePaise || it.mrpPaise || 0) / 100,
                lineTotal: Number(it.lineTotalPaise || (Number(it.unitPricePaise || it.mrpPaise || 0) * it.quantity)) / 100,
                requiresPrescription: Boolean(it.requiresPrescription),
            })),
            timeline: [
                { status: 'Order Placed & Confirmed', time: new Date(o.placedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), completed: true },
                { status: 'Pharmacy Approved & Packed', time: o.status !== 'PENDING_PHARMACY_REVIEW' ? 'Completed' : 'In Review', completed: o.status !== 'PENDING_PHARMACY_REVIEW' },
                { status: 'Rider Out For Delivery', time: ['OUT_FOR_DELIVERY', 'SHIPPED', 'PICKED_UP', 'DELIVERED'].includes(o.status) ? 'Dispatched' : 'Pending', completed: ['OUT_FOR_DELIVERY', 'SHIPPED', 'PICKED_UP', 'DELIVERED'].includes(o.status) },
                { status: 'Delivered to Doorstep', time: o.status === 'DELIVERED' ? 'Delivered' : 'Pending', completed: o.status === 'DELIVERED' },
            ],
        };
    });
};

export const listPharmacyOrders = (pharmacyId: string) =>
    prisma.order.findMany({
        where: { pharmacyId },
        orderBy: { placedAt: 'desc' },
        include: {
            items: true,
            pharmacy: { select: { id: true, name: true } },
            patient: { select: { id: true, fullName: true, phone: true } },
            delivery: {
                include: {
                    rider: { select: { id: true, fullName: true, phone: true } },
                    batch: true,
                },
            },
        },
    });

export const listAllOrders = () =>
    prisma.order.findMany({
        orderBy: { placedAt: 'desc' },
        include: {
            items: true,
            pharmacy: { select: { id: true, name: true } },
            patient: { select: { id: true, fullName: true, phone: true } },
            delivery: {
                include: {
                    rider: { select: { id: true, fullName: true, phone: true } },
                    batch: true,
                },
            },
        },
    });

export const createWalkInOrderTx = (body: any, actor: Actor) =>
    prisma.$transaction(
        async (tx) => {
            let targetPharmacyId: string;
            if (actor.role === 'PHARMACY') {
                const staff = await tx.pharmacyStaff.findFirst({
                    where: { userId: actor.id, isActive: true },
                });
                if (staff) {
                    targetPharmacyId = staff.pharmacyId;
                } else {
                    const primary = await tx.pharmacy.findFirst({
                        where: { isPrimary: true, status: 'ACTIVE' },
                    });
                    if (!primary) throw new ApiError(400, 'No active Primary Pharmacy configured');
                    targetPharmacyId = primary.id;
                }
            } else {
                const primary = await tx.pharmacy.findFirst({
                    where: { isPrimary: true, status: 'ACTIVE' },
                });
                if (!primary) throw new ApiError(400, 'No active Primary Pharmacy configured');
                targetPharmacyId = primary.id;
            }

            // Find or create walk-in patient user
            const cleanPhone = String(body.customerPhone).trim().replace(/[^0-9]/g, '');
            let patient = await tx.user.findFirst({ where: { phone: cleanPhone } });
            if (!patient) {
                const patientRole = await tx.role.findFirst({ where: { name: 'PATIENT' } });
                patient = await tx.user.create({
                    data: {
                        fullName: body.customerName,
                        phone: cleanPhone,
                        roleId: patientRole?.id || '',
                        passwordHash: crypto.randomBytes(32).toString('hex'),
                    },
                });
            }

            const subtotalPaise = Math.round(Number(body.subtotal) * 100);
            const discountPaise = Math.round((Number(body.discount) || 0) * 100);
            // Delivery fee rule: Below ₹499 is ₹30 (3000 paise), ₹499+ is FREE (0 paise). Pickup is ₹0.
            const deliveryFeePaise = body.deliveryType === 'PICKUP'
                ? 0
                : (Number(body.subtotal) < 499 ? 3000 : 0);
            const packagingFeePaise = Math.round((Number(body.packagingFee) ?? 6) * 100);
            // Platform fee rule:
            // Below 999: ₹9, below 1999: ₹12, below 2999: ₹15, below 3999: ₹20, below 5000: ₹25, 5000 onwards: ₹30
            const subtotalRs = Number(body.subtotal) || 0;
            const calcPlatformFeeRs =
                subtotalRs <= 0 ? 0 :
                subtotalRs < 999 ? 9 :
                subtotalRs < 1999 ? 12 :
                subtotalRs < 2999 ? 15 :
                subtotalRs < 3999 ? 20 :
                subtotalRs < 5000 ? 25 : 30;
            const platformFeePaise = Math.round((body.platformFee !== undefined && Number(body.platformFee) > 0 ? Number(body.platformFee) : calcPlatformFeeRs) * 100);
            const totalPaise = Math.max(0, subtotalPaise - discountPaise + packagingFeePaise + platformFeePaise + deliveryFeePaise);

            const orderNumber = `OW-WALK-${Date.now().toString().slice(-6)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
            const deliveryOtp = String(crypto.randomInt(1000, 10000));

            let fallbackProduct = await tx.product.findFirst({ where: { isActive: true } });
            if (!fallbackProduct) {
                let cat = await tx.category.findFirst();
                if (!cat) {
                    cat = await tx.category.create({ data: { name: 'Medicines', slug: `medicines-${Date.now()}` } });
                }
                fallbackProduct = await tx.product.create({
                    data: {
                        name: 'Prescribed Medicine',
                        slug: `med-${Date.now()}`,
                        categoryId: cat.id,
                        mrpPaise: 5000,
                    },
                });
            }

            const isUuid = (val: any): boolean =>
                typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);

            // Only link prescriptionId if it is a valid UUID that exists in DB
            let linkedPrescriptionId: string | undefined = undefined;
            if (body.prescriptionId && isUuid(body.prescriptionId)) {
                const rx = await tx.prescription.findUnique({ where: { id: body.prescriptionId } });
                if (rx) {
                    linkedPrescriptionId = rx.id;
                }
            }

            // Only use productId if it is a valid UUID that exists in products table, otherwise fallbackProduct.id
            const orderItemsData = await Promise.all(
                body.items.map(async (it: any) => {
                    let finalProductId = fallbackProduct!.id;
                    if (it.productId && isUuid(it.productId)) {
                        const prod = await tx.product.findUnique({ where: { id: it.productId } });
                        if (prod) finalProductId = prod.id;
                    }
                    return {
                        productId: finalProductId,
                        nameSnapshot: it.name,
                        quantity: Number(it.quantity || it.qty || 1),
                        mrpPaise: Math.round((Number(it.price) || 0) * 100),
                        unitPricePaise: Math.round((Number(it.price) || 0) * 100),
                        lineTotalPaise: Math.round((Number(it.price) || 0) * Number(it.quantity || it.qty || 1) * 100),
                        requiresPrescription: false,
                        prescriptionVerified: true,
                    };
                })
            );

            const initialStatus = body.status === 'READY_FOR_PICKUP' ? 'READY_FOR_PICKUP' : 'PREPARING';

            const order = await tx.order.create({
                data: {
                    orderNumber,
                    patientId: patient.id,
                    pharmacyId: targetPharmacyId,
                    prescriptionId: linkedPrescriptionId,
                    deliveryAddress: {
                        fullName: body.customerName,
                        phone: cleanPhone,
                        line1: body.address || (body.deliveryType === 'PICKUP' ? 'Counter Pickup' : 'Home Delivery Address'),
                        area: body.area || 'City Centre',
                        city: 'Kolkata',
                        pincode: body.pincode || '',
                        deliveryType: body.deliveryType,
                        discountType: body.discountType || 'PERCENT',
                        discountValue: body.discountValue || 0,
                        notes: body.notes || '',
                        deliveryOtp,
                    },
                    status: initialStatus,
                    paymentMethod: 'COD',
                    paymentStatus: 'PENDING',
                    subtotalPaise,
                    couponDiscountPaise: discountPaise,
                    deliveryFeePaise,
                    totalPaise,
                    items: { create: orderItemsData },
                    history: {
                        create: {
                            fromStatus: null,
                            toStatus: initialStatus,
                            actorId: actor.id,
                            actorRole: actor.role,
                        },
                    },
                },
                include: {
                    items: true,
                    patient: { select: { id: true, fullName: true, phone: true } },
                    delivery: {
                        include: {
                            rider: { select: { id: true, fullName: true, phone: true } },
                        },
                    },
                },
            });

            // In-app notification for pharmacy staff for preparation
            if (targetPharmacyId) {
                const pharmacyStaff = await tx.pharmacyStaff.findMany({
                    where: { pharmacyId: targetPharmacyId, isActive: true },
                    select: { userId: true },
                });
                for (const ps of pharmacyStaff) {
                    await tx.notification.create({
                        data: {
                            userId: ps.userId,
                            category: 'ORDER',
                            eventType: 'ORDER_PREPARING',
                            title: `Order #${order.orderNumber} - Approved & Preparing`,
                            body: `Prescription approved. Please assemble package and mark "Prepared" when ready for dispatch.`,
                            data: { orderId: order.id, orderNumber: order.orderNumber, link: '/pharmacy/orders' },
                            priority: 'HIGH',
                            dedupeKey: `notif_order_prep_${order.id}_${ps.userId}`,
                        },
                    }).catch(() => {});
                }
            }

            if (linkedPrescriptionId) {
                try {
                    await tx.prescription.update({
                        where: { id: linkedPrescriptionId },
                        data: {
                            status: 'VERIFIED',
                            verifiedById: actor.id,
                            verifiedAt: new Date(),
                        },
                    });
                } catch {}
            }

            return {
                ...order,
                deliveryOtp,
                total: Number(order.totalPaise || 0) / 100,
                subtotal: Number(order.subtotalPaise || 0) / 100,
            };
        },
        { maxWait: 10000, timeout: 30000 }
    );

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
