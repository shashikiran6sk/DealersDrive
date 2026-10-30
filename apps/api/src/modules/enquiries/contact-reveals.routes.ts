import { Router, type RequestHandler } from 'express';
import type { RouteRegistrar } from '../../http/route.js';
import type { RateLimiter } from '../../middleware/rate-limit.js';
import type { EnquiriesService } from './enquiries.service.js';
import { postRevealContact } from './routes/post-reveal-contact.js';

interface ContactRevealDeps {
  service: EnquiriesService;
  rateLimit: RateLimiter;
  requireCustomer: RequestHandler;
  legalGate: RequestHandler;
}
export type ContactRevealRoute = RouteRegistrar<ContactRevealDeps>;

export function createContactRevealsRouter(
  service: EnquiriesService,
  rateLimit: RateLimiter,
  requireCustomer: RequestHandler,
  legalGate: RequestHandler,
): Router {
  const router = Router();
  postRevealContact(router, { service, rateLimit, requireCustomer, legalGate });
  return router;
}
