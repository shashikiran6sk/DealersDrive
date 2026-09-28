import type { RouteRegistrar } from '../../../http/route.js';
import type { RateLimiter } from '../../../middleware/rate-limit.js';
import type { SavedVehiclesService } from '../saved-vehicles.service.js';

export interface SavedVehiclesDeps {
  service: SavedVehiclesService;
  rateLimit: RateLimiter;
}

export type SavedVehiclesRoute = RouteRegistrar<SavedVehiclesDeps>;
