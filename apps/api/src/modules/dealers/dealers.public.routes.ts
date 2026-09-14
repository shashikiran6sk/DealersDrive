import { Router } from 'express';

import type { RateLimiter } from '../../middleware/rate-limit.js';
import type { DealersPublicService } from './dealers.public.service.js';
import { getDealer } from './public-routes/get-dealer.js';
import { getDealers } from './public-routes/get-dealers.js';
import { getLocations } from './public-routes/get-locations.js';
import { getSearchDealers } from './public-routes/get-search-dealers.js';
import type { PublicDealersRoute } from './public-routes/route.js';

const ROUTES: PublicDealersRoute[] = [getDealers, getSearchDealers, getLocations, getDealer];

export function createPublicDealersRouter(
  service: DealersPublicService,
  rateLimit: RateLimiter,
): Router {
  const router = Router();
  const publicReads = rateLimit('public-read', { limit: 120, windowSeconds: 60 });
  for (const route of ROUTES) route(router, { service, publicReads });
  return router;
}
