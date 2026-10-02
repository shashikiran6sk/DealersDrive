import { Router } from 'express';

import type { ModerationService } from './moderation.service.js';
import { getListing } from './routes/get-listing.js';
import { getListings } from './routes/get-listings.js';
import { getReactivationRequests } from './routes/get-reactivation-requests.js';
import { postListingApprove } from './routes/post-listing-approve.js';
import { postListingReject } from './routes/post-listing-reject.js';
import { postListingRequestChanges } from './routes/post-listing-request-changes.js';
import { postReactivationRequestApprove } from './routes/post-reactivation-request-approve.js';
import { postReactivationRequestReject } from './routes/post-reactivation-request-reject.js';
import { putListingCheck } from './routes/put-listing-check.js';
import { putListingPhotography } from './routes/put-listing-photography.js';
import type { ModerationRoute } from './routes/route.js';

const ROUTES: ModerationRoute[] = [
  getListings,
  getListing,
  putListingCheck,
  putListingPhotography,
  postListingRequestChanges,
  postListingReject,
  postListingApprove,
  getReactivationRequests,
  postReactivationRequestReject,
  postReactivationRequestApprove,
];

export function createModerationRouter(service: ModerationService): Router {
  const router = Router();
  for (const route of ROUTES) route(router, service);
  return router;
}
