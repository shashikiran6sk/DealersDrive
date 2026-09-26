import { Router } from 'express';

import type { ModerationService } from './moderation.service.js';
import { getListing } from './routes/get-listing.js';
import { getListings } from './routes/get-listings.js';
import { putListingCheck } from './routes/put-listing-check.js';
import type { ModerationRoute } from './routes/route.js';

const ROUTES: ModerationRoute[] = [getListings, getListing, putListingCheck];

export function createModerationRouter(service: ModerationService): Router {
  const router = Router();
  for (const route of ROUTES) route(router, service);
  return router;
}
