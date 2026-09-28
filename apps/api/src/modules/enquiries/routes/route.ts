import type { RouteRegistrar } from '../../../http/route.js';
import type { RateLimiter } from '../../../middleware/rate-limit.js';
import type { EnquiriesService } from '../enquiries.service.js';

export interface EnquiriesDeps {
  service: EnquiriesService;
  rateLimit: RateLimiter;
}

export type EnquiriesRoute = RouteRegistrar<EnquiriesDeps>;
