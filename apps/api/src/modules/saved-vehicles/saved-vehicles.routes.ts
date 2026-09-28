import { Router } from 'express';

import type { RateLimiter } from '../../middleware/rate-limit.js';
import { deleteSavedVehicle } from './routes/delete-saved-vehicle.js';
import { getSavedSlugs } from './routes/get-saved-slugs.js';
import { getSavedVehicles } from './routes/get-saved-vehicles.js';
import { putSavedVehicle } from './routes/put-saved-vehicle.js';
import type { SavedVehiclesRoute } from './routes/route.js';
import type { SavedVehiclesService } from './saved-vehicles.service.js';

const ROUTES: SavedVehiclesRoute[] = [
  getSavedVehicles,
  getSavedSlugs,
  putSavedVehicle,
  deleteSavedVehicle,
];

export function createSavedVehiclesRouter(
  service: SavedVehiclesService,
  rateLimit: RateLimiter,
): Router {
  const router = Router();
  for (const route of ROUTES) route(router, { service, rateLimit });
  return router;
}
