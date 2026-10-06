import type { RouteRegistrar } from '../../../http/route.js';
import type { RateLimiter } from '../../../middleware/rate-limit.js';
import type { SalesService } from '../sales.service.js';

export interface SalesRouteDeps {
  service: SalesService;
  rateLimit: RateLimiter;
}

export type SalesRoute = RouteRegistrar<SalesRouteDeps>;

export { handle } from '../../admin/routes/handle.js';
