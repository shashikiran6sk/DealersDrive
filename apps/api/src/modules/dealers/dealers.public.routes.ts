import { Router } from 'express';

import type { RateLimiter } from '../../middleware/rate-limit.js';
import type { DealersPublicService } from './dealers.public.service.js';
import { getDealer } from './public-routes/get-dealer.js';
import { getDealers } from './public-routes/get-dealers.js';
import { getLocations } from './public-routes/get-locations.js';
import { getSearchDealers } from './public-routes/get-search-dealers.js';
import type { PublicDealersRoute } from './public-routes/route.js';

/**
 * A8–A9. Public, IP rate-limited, CDN-cacheable. Mounted under `/v1`.
 *
 * `validate({ query: DealerDirectoryQuery })` is doing real work here: the
 * schema is `.strict()`, so `/v1/dealers?town=vellore` is a 400 that *names*
 * `town` rather than a silently unfiltered page of every dealership on the
 * platform (ARCHITECTURE §9.2).
 *
 * ── Reconstruction slice ────────────────────────────────────────────────────
 * The baseline mounted these two paths inside `search.routes.ts`, alongside
 * `/v1/vehicles`, and handed that router a `DealersPublicService` to call. The
 * search module does not exist yet — it arrives at **F076** — and these two
 * routes touch nothing it owns: they call `dealersPublic` and nothing else.
 *
 * So they live in the module whose service answers them. F076 has no reason to
 * take them back, and if it did the mount point would stay `/v1/dealers`
 * either way.
 * ────────────────────────────────────────────────────────────────────────────
 */
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
