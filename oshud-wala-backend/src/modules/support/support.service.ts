import { RoleName } from '@prisma/client';
import { ApiError } from '../../utils/apiError';
import * as repo from './support.repository';

type Actor = { id: string; role: RoleName };

export const createTicket = (body: any, actor: Actor) =>
    repo.createTicketTx(
        actor.id,
        String(body.subject).trim(),
        String(body.message).trim(),
        body.orderId ?? null,
        body.priority ?? 'NORMAL'
    );

export const listTickets = (actor: Actor) =>
    repo.listTickets(actor.role === 'SUPER_ADMIN' ? undefined : actor.id);

export const getTicket = async (id: string, actor: Actor) => {
    const ticket = await repo.findTicketById(id);
    if (!ticket) throw new ApiError(404, 'Support ticket not found');
    if (actor.role !== 'SUPER_ADMIN' && ticket.userId !== actor.id) {
        throw new ApiError(403, 'You can only view your own support tickets');
    }
    return ticket;
};

export const addMessage = async (id: string, body: string, actor: Actor) => {
    const ticket = await repo.findTicketById(id);
    if (!ticket) throw new ApiError(404, 'Support ticket not found');
    if (actor.role !== 'SUPER_ADMIN' && ticket.userId !== actor.id) {
        throw new ApiError(403, 'You can only reply to your own support tickets');
    }
    if (ticket.status === 'CLOSED') throw new ApiError(400, 'Cannot reply to a CLOSED ticket');
    return await repo.addTicketMessage(id, actor.id, String(body).trim());
};

export const updateTicketStatus = async (id: string, data: any) => {
    const ticket = await repo.findTicketById(id);
    if (!ticket) throw new ApiError(404, 'Support ticket not found');
    return await repo.updateTicket(id, data);
};
