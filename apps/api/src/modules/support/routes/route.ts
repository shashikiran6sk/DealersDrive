import type { RouteRegistrar } from '../../../http/route.js';
import type { RateLimiter } from '../../../middleware/rate-limit.js';
import type { SupportService } from '../support.service.js';

export interface SupportRouteDeps {
  service: SupportService;
  rateLimit: RateLimiter;
}

export type SupportRoute = RouteRegistrar<SupportRouteDeps>;
