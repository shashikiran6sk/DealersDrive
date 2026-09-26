import { Router } from 'express';

import type { ModerationService } from './moderation.service.js';
import { getListing } from './routes/get-listing.js';
import { getListings } from './routes/get-listings.js';
import { postListingReject } from './routes/post-listing-reject.js';
import { postListingRequestChanges } from './routes/post-listing-request-changes.js';
import { putListingCheck } from './routes/put-listing-check.js';
import type { ModerationRoute } from './routes/route.js';

const ROUTES: ModerationRoute[] = [
  getListings,
  getListing,
  putListingCheck,
  postListingRequestChanges,
  postListingReject,
];

export function createModerationRouter(service: ModerationService): Router {
  const router = Router();
  for (const route of ROUTES) route(router, service);
  return router;
}
