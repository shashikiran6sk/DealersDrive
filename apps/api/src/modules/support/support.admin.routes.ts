import { Router } from 'express';

import type { AdminSupportService } from './support.admin.service.js';
import type { AdminSupportRoute } from './routes/admin-route.js';
import { getAdminTicket } from './routes/get-admin-ticket.js';
import { getAdminTickets } from './routes/get-admin-tickets.js';
import { patchAdminTicket } from './routes/patch-admin-ticket.js';
import { postAdminTicketMessage } from './routes/post-admin-ticket-message.js';
import { postAdminTicketNote } from './routes/post-admin-ticket-note.js';

const ROUTES: AdminSupportRoute[] = [
  getAdminTickets,
  getAdminTicket,
  patchAdminTicket,
  postAdminTicketMessage,
  postAdminTicketNote,
];

export function createAdminSupportRouter(service: AdminSupportService): Router {
  const router = Router();
  for (const route of ROUTES) route(router, service);
  return router;
}
