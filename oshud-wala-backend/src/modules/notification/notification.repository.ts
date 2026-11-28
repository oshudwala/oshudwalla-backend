import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const saveOrUpdateDeviceToken = async (userId: string, fcmToken: string, deviceType: any, deviceId?: string) => {
    const existingToken = await prisma.deviceToken.findFirst({
        where: { userId, token: fcmToken }
    });

    if (existingToken) {
        return existingToken;
    }

    return await prisma.deviceToken.create({
        data: {
            userId,
            token: fcmToken,
            platform: deviceType,
            deviceId: deviceId || ""
        }
    });
};

export const removeDeviceToken = async (userId: string, fcmToken: string) => {
    return await prisma.deviceToken.deleteMany({
        where: { userId, token: fcmToken }
    });
};

export const getNotificationSettings = async (userId: string) => {
    return await prisma.notificationSetting.findUnique({
        where: { userId }
    });
};

export const getNotificationPreferences = async (userId: string) => {
    return await prisma.notificationPreference.findMany({
        where: { userId }
    });
};

export const upsertGlobalSettings = async (userId: string, data: any) => {
    return await prisma.notificationSetting.upsert({
        where: { userId },
        update: data,
        create: { userId, ...data }
    });
};

export const upsertCategoryPreferences = async (userId: string, categories: any[]) => {
    return await prisma.$transaction(
        categories.map(cat =>
            prisma.notificationPreference.upsert({
                where: { userId_category: { userId, category: cat.category } },
                update: { pushEnabled: cat.pushEnabled, inAppEnabled: cat.inAppEnabled },
                create: { userId, category: cat.category, pushEnabled: cat.pushEnabled, inAppEnabled: cat.inAppEnabled }
            })
        )
    );
};

// ---------------------------------------------------------------------------
// IN-APP NOTIFICATION REPOSITORY (Strictly scoped by userId)
// ---------------------------------------------------------------------------

export interface NotificationQueryOptions {
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
    category?: any;
}

export const getNotificationsByUser = async (userId: string, options: NotificationQueryOptions = {}) => {
    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(options.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = {
        userId,
        NOT: {
            dedupeKey: { startsWith: 'init_' }
        }
    };
    if (options.unreadOnly) {
        where.readAt = null;
    }
    if (options.category) {
        where.category = options.category;
    }

    const [items, total, unreadCount] = await Promise.all([
        prisma.notification.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
        }),
        prisma.notification.count({ where }),
        prisma.notification.count({
            where: {
                userId,
                readAt: null,
                NOT: {
                    dedupeKey: { startsWith: 'init_' }
                }
            }
        }),
    ]);

    return {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
        unreadCount,
    };
};

export const getUnreadCountByUser = async (userId: string) => {
    return await prisma.notification.count({
        where: {
            userId,
            readAt: null,
            NOT: {
                dedupeKey: { startsWith: 'init_' }
            }
        }
    });
};

export const markNotificationRead = async (notificationId: string, userId: string) => {
    return await prisma.notification.updateMany({
        where: { id: notificationId, userId },
        data: { readAt: new Date() }
    });
};

export const markAllNotificationsRead = async (userId: string) => {
    return await prisma.notification.updateMany({
        where: { userId, readAt: null },
        data: { readAt: new Date() }
    });
};

export const deleteNotification = async (notificationId: string, userId: string) => {
    return await prisma.notification.deleteMany({
        where: { id: notificationId, userId }
    });
};

export const clearReadNotifications = async (userId: string) => {
    return await prisma.notification.deleteMany({
        where: { userId, readAt: { not: null } }
    });
};

export const createInAppNotification = async (data: {
    userId: string;
    doctorId?: string;
    category: any;
    eventType: string;
    title: string;
    body: string;
    data?: any;
    priority?: any;
    dedupeKey?: string;
}) => {
    const dedupeKey = data.dedupeKey || `notif_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    return await prisma.notification.create({
        data: {
            userId: data.userId,
            doctorId: data.doctorId,
            category: data.category || 'SYSTEM',
            eventType: data.eventType || 'IN_APP_MESSAGE',
            title: data.title,
            body: data.body,
            data: data.data || {},
            priority: data.priority || 'NORMAL',
            dedupeKey,
        }
    });
};

export const syncPharmacyNotifications = async (userId: string, role?: string) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { role: true, pharmacyStaff: true },
        });

        const isPharmacy =
            role === 'PHARMACY' ||
            user?.role?.name === 'PHARMACY' ||
            (user?.pharmacyStaff && user.pharmacyStaff.some((s: any) => s.isActive));

        if (!isPharmacy) return;

        // Find primary or associated pharmacy
        let targetPharmacyId = user?.pharmacyStaff?.find((s: any) => s.isActive)?.pharmacyId;
        if (!targetPharmacyId) {
            const primary = await prisma.pharmacy.findFirst({
                where: { isPrimary: true, status: 'ACTIVE' },
            });
            targetPharmacyId = primary?.id;
        }
        if (!targetPharmacyId) {
            const anyActive = await prisma.pharmacy.findFirst({
                where: { status: 'ACTIVE' },
            });
            targetPharmacyId = anyActive?.id;
        }

        if (!targetPharmacyId) return;

        // 1. Sync pending prescriptions for this pharmacy
        const pendingRx = await prisma.prescription.findMany({
            where: {
                status: { in: ['SUBMITTED', 'FORWARDED_TO_PHARMACY', 'PHARMACY_VERIFYING'] },
                OR: [{ pharmacyId: targetPharmacyId }, { pharmacyId: null }],
            },
            take: 20,
            orderBy: { createdAt: 'desc' },
            include: { items: true },
        });

        for (const rx of pendingRx) {
            const dedupeKey = `rx_audit_${rx.id}`;
            await prisma.notification.upsert({
                where: { userId_dedupeKey: { userId, dedupeKey } },
                create: {
                    userId,
                    category: 'PRESCRIPTION',
                    eventType: 'PRESCRIPTION_SUBMITTED',
                    title: `Prescription Awaiting Audit #${rx.prescriptionNumber}`,
                    body: `Prescription #${rx.prescriptionNumber} submitted for pharmacist verification & dispensing.`,
                    data: {
                        prescriptionId: rx.id,
                        prescriptionNumber: rx.prescriptionNumber,
                        link: '/pharmacy/prescriptions',
                    },
                    priority: 'HIGH',
                    dedupeKey,
                },
                update: {},
            }).catch(() => {});
        }

        // 2. Sync orders requiring pharmacy fulfillment
        const activeOrders = await prisma.order.findMany({
            where: {
                pharmacyId: targetPharmacyId,
                status: { in: ['ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP'] },
            },
            take: 20,
            orderBy: { placedAt: 'desc' },
            include: { items: true },
        });

        for (const o of activeOrders) {
            const dedupeKey = `ord_action_${o.status.toLowerCase()}_${o.id}`;
            let title = `Order #${o.orderNumber}`;
            let body = `Order #${o.orderNumber} for ₹${(o.totalPaise / 100).toFixed(2)}`;
            let link = '/pharmacy/orders';

            if (o.status === 'PREPARING') {
                title = `Order #${o.orderNumber} - Approved & Preparing`;
                body = `Prescription approved. Pack medicines and click "Prepared" when ready for pickup.`;
                link = '/pharmacy/orders';
            } else if (o.status === 'READY_FOR_PICKUP') {
                title = `Order #${o.orderNumber} - Approved & Prepared`;
                body = `Medicines packed and ready for rider pickup and handover.`;
                link = '/pharmacy/pickup';
            }

            await prisma.notification.upsert({
                where: { userId_dedupeKey: { userId, dedupeKey } },
                create: {
                    userId,
                    category: o.status === 'READY_FOR_PICKUP' ? 'DELIVERY' : 'ORDER',
                    eventType: `ORDER_${o.status}`,
                    title,
                    body,
                    data: { orderId: o.id, orderNumber: o.orderNumber, link },
                    priority: 'NORMAL',
                    dedupeKey,
                },
                update: {},
            }).catch(() => {});
        }
    } catch (err) {
        console.warn('syncPharmacyNotifications warning:', err);
    }
};