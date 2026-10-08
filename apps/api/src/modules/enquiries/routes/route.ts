import type { RouteRegistrar } from '../../../http/route.js';
import type { RateLimiter } from '../../../middleware/rate-limit.js';
import type { EnquiriesService } from '../enquiries.service.js';
import type { StorefrontService } from '../../storefront/storefront.facade.js';

export interface EnquiriesDeps {
  service: EnquiriesService;
  rateLimit: RateLimiter;
  storefront: StorefrontService;
}

export type EnquiriesRoute = RouteRegistrar<EnquiriesDeps>;
