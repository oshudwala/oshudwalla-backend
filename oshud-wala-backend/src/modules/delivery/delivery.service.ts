import { RoleName } from '@prisma/client';
import { ApiError } from '../../utils/apiError';
import * as repo from './delivery.repository';
import { decryptOtp } from './delivery.crypto';

type Actor = { id: string; role: RoleName };

export const assignDeliveries = async (riderId: string, orderIds: string[], actor: Actor) => {
    const uniqueOrderIds = Array.from(new Set(orderIds));
    return await repo.assignOrdersToRiderTx(riderId, uniqueOrderIds, actor);
};

export const getOrderPickupQr = async (orderId: string, actor: Actor) => {
    return await repo.getOrderPickupQr(orderId, actor);
};

export const getMyDeliveries = async (riderId: string, actor: Actor) => {
    return await repo.listRiderDeliveries(riderId, actor);
};

export const scanPickupQr = async (qrToken: string, actor: Actor) => {
    return await repo.scanPickupQrTx(qrToken, actor.id, actor);
};

export const markArrived = async (deliveryId: string, actor: Actor) => {
    return await repo.markArrivedAndGenerateOtpTx(deliveryId, actor.id, actor);
};

export const getCustomerDeliveryOtp = async (orderId: string, customerId: string) => {
    const record = await repo.findActiveCustomerDeliveryOtp(orderId, customerId);
    if (!record) throw new ApiError(404, 'No active delivery OTP found for this order');
    if (record.expiresAt < new Date()) throw new ApiError(400, 'Delivery OTP has expired');
    return {
        orderId,
        otp: decryptOtp(record.otpCiphertext),
        expiresAt: record.expiresAt,
    };
};

export const completeDelivery = async (deliveryId: string, otp: string, actor: Actor) => {
    return await repo.completeDeliveryWithOtpTx(deliveryId, actor.id, otp, actor);
};
