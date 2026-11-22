import { Router } from 'express';
import { authenticate, authorizeRoles } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import * as c from './support.controller';
import { createTicketSchema, ticketIdParamSchema, addMessageSchema, updateTicketStatusSchema } from './support.validation';

const router = Router();
router.use(authenticate);

router.post('/tickets', validate(createTicketSchema), c.createTicket);
router.get('/tickets', c.listTickets);
router.get('/tickets/:id', validate(ticketIdParamSchema), c.getTicket);
router.post('/tickets/:id/messages', validate(addMessageSchema), c.addMessage);
router.patch('/tickets/:id/status', authorizeRoles('SUPER_ADMIN'), validate(updateTicketStatusSchema), c.updateTicketStatus);

export default router;
