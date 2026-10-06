import { Router } from 'express';

import type { RateLimiter } from '../../middleware/rate-limit.js';
import type { DealerClaimsService } from './dealer-claims.service.js';
import { getClaim } from './routes/get-claim.js';
import { postClaimVerifyEmail } from './routes/post-claim-verify-email.js';
import { postClaim } from './routes/post-claim.js';
import type { DealerClaimsRoute } from './routes/route.js';

const ROUTES: DealerClaimsRoute[] = [getClaim, postClaimVerifyEmail, postClaim];

export function createDealerClaimsRouter(
  service: DealerClaimsService,
  rateLimit: RateLimiter,
): Router {
  const router = Router();
  for (const route of ROUTES) route(router, { service, rateLimit });
  return router;
}
