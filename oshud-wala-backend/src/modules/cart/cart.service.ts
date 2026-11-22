import { ApiError } from '../../utils/apiError';
import * as repo from './cart.repository';

const formatCart = (cart: any) => {
    let subtotalPaise = 0;
    let requiresPrescription = false;
    const items = cart.items.map((item: any) => {
        const lineTotalPaise = item.product.mrpPaise * item.quantity;
        subtotalPaise += lineTotalPaise;
        if (item.product.requiresPrescription) requiresPrescription = true;
        return { ...item, lineTotalPaise };
    });
    return {
        id: cart.id,
        items,
        itemCount: items.reduce((sum: number, i: any) => sum + i.quantity, 0),
        subtotalPaise,
        requiresPrescription,
    };
};

export const getMyCart = async (userId: string) => {
    const cart = await repo.getOrCreateCart(userId);
    return formatCart(cart);
};

export const addItem = async (userId: string, productId: string, quantity: number) => {
    const product = await repo.findActiveProduct(productId);
    if (!product) throw new ApiError(404, 'Active product not found');
    const cart = await repo.upsertCartItem(userId, productId, quantity);
    return formatCart(cart);
};

export const updateItemQuantity = async (userId: string, productId: string, quantity: number) => {
    if (quantity > 0) {
        const product = await repo.findActiveProduct(productId);
        if (!product) throw new ApiError(404, 'Active product not found');
    }
    const cart = await repo.setCartItemQuantity(userId, productId, quantity);
    return formatCart(cart);
};

export const removeItem = async (userId: string, productId: string) => {
    const cart = await repo.setCartItemQuantity(userId, productId, 0);
    return formatCart(cart);
};

export const clearMyCart = async (userId: string) => {
    const cart = await repo.clearCart(userId);
    return formatCart(cart);
};
