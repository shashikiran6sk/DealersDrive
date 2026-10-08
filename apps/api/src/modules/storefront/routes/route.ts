import type { RouteRegistrar } from '../../../http/route.js';
import type { RateLimiter } from '../../../middleware/rate-limit.js';
import type { StorefrontService } from '../storefront.service.js';
import type { StorefrontMediaService } from '../storefront.media.js';

export type StorefrontRoute = RouteRegistrar<{
  service: StorefrontService;
  rateLimit: RateLimiter;
  media: StorefrontMediaService;
}>;
