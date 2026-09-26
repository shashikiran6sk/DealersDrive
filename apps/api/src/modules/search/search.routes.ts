import { Router } from 'express';

import type { RateLimiter } from '../../middleware/rate-limit.js';
import { getVehicle } from './routes/get-vehicle.js';
import { getVehicles } from './routes/get-vehicles.js';
import type { SearchRoute } from './routes/route.js';
import type { SearchService } from './search.service.js';

const ROUTES: SearchRoute[] = [getVehicles, getVehicle];

export function createSearchRouter(service: SearchService, rateLimit: RateLimiter): Router {
  const router = Router();
  const publicReads = rateLimit('public-read', { limit: 120, windowSeconds: 60 });
  for (const route of ROUTES) route(router, { service, publicReads });
  return router;
}
