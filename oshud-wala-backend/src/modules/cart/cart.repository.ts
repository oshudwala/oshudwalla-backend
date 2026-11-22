import { prisma } from '../../config/prisma';

const cartInclude = {
    items: {
        orderBy: { addedAt: 'asc' as const },
        include: {
            product: {
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    packSize: true,
                    mrpPaise: true,
                    requiresPrescription: true,
                    imageUrls: true,
                    isActive: true,
                },
            },
        },
    },
};

export const findActiveProduct = (productId: string) =>
    prisma.product.findFirst({ where: { id: productId, isActive: true } });

export const getOrCreateCart = (userId: string) =>
    prisma.cart.upsert({
        where: { userId },
        create: { userId },
        update: {},
        include: cartInclude,
    });

export const upsertCartItem = async (userId: string, productId: string, quantityDelta: number) => {
    const cart = await prisma.cart.upsert({ where: { userId }, create: { userId }, update: {} });
    await prisma.cartItem.upsert({
        where: { cartId_productId: { cartId: cart.id, productId } },
        create: { cartId: cart.id, productId, quantity: quantityDelta },
        update: { quantity: { increment: quantityDelta } },
    });
    return prisma.cart.findUniqueOrThrow({ where: { id: cart.id }, include: cartInclude });
};

export const setCartItemQuantity = async (userId: string, productId: string, quantity: number) => {
    const cart = await prisma.cart.upsert({ where: { userId }, create: { userId }, update: {} });
    if (quantity <= 0) {
        await prisma.cartItem.deleteMany({ where: { cartId: cart.id, productId } });
    } else {
        await prisma.cartItem.upsert({
            where: { cartId_productId: { cartId: cart.id, productId } },
            create: { cartId: cart.id, productId, quantity },
            update: { quantity },
        });
    }
    return prisma.cart.findUniqueOrThrow({ where: { id: cart.id }, include: cartInclude });
};

export const clearCart = async (userId: string) => {
    const cart = await prisma.cart.findUnique({ where: { userId } });
    if (cart) {
        await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    }
    return getOrCreateCart(userId);
};
