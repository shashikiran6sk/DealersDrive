import { Router } from 'express';

import type { RateLimiter } from '../../middleware/rate-limit.js';
import type { EnquiriesService } from './enquiries.service.js';
import { getMyEnquiry } from './routes/get-my-enquiry.js';
import { getMyEnquiries } from './routes/get-my-enquiries.js';
import { postWithdrawSharing } from './routes/post-withdraw-sharing.js';
import { postEnquiry } from './routes/post-enquiry.js';
import type { EnquiriesRoute } from './routes/route.js';

const ROUTES: EnquiriesRoute[] = [getMyEnquiries, getMyEnquiry, postEnquiry, postWithdrawSharing];

export function createEnquiriesRouter(service: EnquiriesService, rateLimit: RateLimiter): Router {
  const router = Router();
  for (const route of ROUTES) route(router, { service, rateLimit });
  return router;
}
