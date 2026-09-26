import { Router } from 'express';

import type { ModerationService } from './moderation.service.js';
import { getListings } from './routes/get-listings.js';
import type { ModerationRoute } from './routes/route.js';

const ROUTES: ModerationRoute[] = [getListings];

export function createModerationRouter(service: ModerationService): Router {
  const router = Router();
  for (const route of ROUTES) route(router, service);
  return router;
}
