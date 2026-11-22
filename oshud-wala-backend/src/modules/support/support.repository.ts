import crypto from 'crypto';
import { prisma } from '../../config/prisma';

export const createTicketTx = (userId: string, subject: string, message: string, orderId: string | null, priority: any) =>
    prisma.supportTicket.create({
        data: {
            ticketNumber: `TKT-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
            userId,
            orderId,
            subject,
            priority,
            status: 'OPEN',
            messages: { create: { senderId: userId, body: message } },
        },
        include: { messages: true },
    });

export const listTickets = (userId?: string) =>
    prisma.supportTicket.findMany({
        where: userId ? { userId } : {},
        orderBy: { updatedAt: 'desc' },
        include: {
            user: { select: { id: true, fullName: true, phone: true } },
            _count: { select: { messages: true } },
        },
    });

export const findTicketById = (id: string) =>
    prisma.supportTicket.findUnique({
        where: { id },
        include: {
            messages: {
                orderBy: { createdAt: 'asc' },
                include: { sender: { select: { id: true, fullName: true } } },
            },
        },
    });

export const addTicketMessage = (ticketId: string, senderId: string, body: string) =>
    prisma.supportMessage.create({
        data: { ticketId, senderId, body },
        include: { sender: { select: { id: true, fullName: true } } },
    });

export const updateTicket = (id: string, data: any) =>
    prisma.supportTicket.update({ where: { id }, data });
