import { Router } from 'express';

import type { RateLimiter } from '../../middleware/rate-limit.js';
import type { SupportService } from './support.service.js';
import { getMyTicket } from './routes/get-my-ticket.js';
import { getMyTickets } from './routes/get-my-tickets.js';
import { postTicket } from './routes/post-ticket.js';
import { postTicketMessage } from './routes/post-ticket-message.js';
import type { SupportRoute } from './routes/route.js';

const ROUTES: SupportRoute[] = [getMyTickets, postTicket, getMyTicket, postTicketMessage];

export function createSupportRouter(service: SupportService, rateLimit: RateLimiter): Router {
  const router = Router();
  for (const route of ROUTES) route(router, { service, rateLimit });
  return router;
}
