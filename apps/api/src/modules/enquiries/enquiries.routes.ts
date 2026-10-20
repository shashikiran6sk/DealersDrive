import { Router } from 'express';

import type { RateLimiter } from '../../middleware/rate-limit.js';
import type { EnquiriesService } from './enquiries.service.js';
import { getMyEnquiries } from './routes/get-my-enquiries.js';
import { postEnquiry } from './routes/post-enquiry.js';
import type { EnquiriesRoute } from './routes/route.js';

const ROUTES: EnquiriesRoute[] = [getMyEnquiries, postEnquiry];

export function createEnquiriesRouter(service: EnquiriesService, rateLimit: RateLimiter): Router {
  const router = Router();
  for (const route of ROUTES) route(router, { service, rateLimit });
  return router;
}
