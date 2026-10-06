import type { RouteRegistrar } from '../../../http/route.js';
import type { RateLimiter } from '../../../middleware/rate-limit.js';
import type { DealerClaimsService } from '../dealer-claims.service.js';

export interface DealerClaimsRouteDeps {
  service: DealerClaimsService;
  rateLimit: RateLimiter;
}

export type DealerClaimsRoute = RouteRegistrar<DealerClaimsRouteDeps>;

export { handle } from '../../admin/routes/handle.js';
