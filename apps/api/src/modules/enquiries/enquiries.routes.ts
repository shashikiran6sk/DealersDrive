import { Router } from 'express';

import type { RateLimiter } from '../../middleware/rate-limit.js';
import type { EnquiriesService } from './enquiries.service.js';
import type { StorefrontService } from '../storefront/storefront.facade.js';
import { postStorefrontEnquiry } from './routes/post-storefront-enquiry.js';
import { getMyEnquiries } from './routes/get-my-enquiries.js';
import { postEnquiry } from './routes/post-enquiry.js';
import type { EnquiriesRoute } from './routes/route.js';

const ROUTES: EnquiriesRoute[] = [getMyEnquiries, postEnquiry, postStorefrontEnquiry];

export function createEnquiriesRouter(
  service: EnquiriesService,
  rateLimit: RateLimiter,
  storefront: StorefrontService,
): Router {
  const router = Router();
  for (const route of ROUTES) route(router, { service, rateLimit, storefront });
  return router;
}
