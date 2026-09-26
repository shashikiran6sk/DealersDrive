import { Router } from 'express';

import { deleteVehicle } from './routes/delete-vehicle.js';
import { getVehicle } from './routes/get-vehicle.js';
import { getVehicleSuggestions } from './routes/get-vehicle-suggestions.js';
import { patchVehicle } from './routes/patch-vehicle.js';
import { postVehicle } from './routes/post-vehicle.js';
import { postVehicleSubmit } from './routes/post-vehicle-submit.js';
import type { VehiclesRoute } from './routes/route.js';
import type { VehiclesService } from './vehicles.service.js';

const ROUTES: VehiclesRoute[] = [
  postVehicle,
  getVehicleSuggestions,
  getVehicle,
  patchVehicle,
  deleteVehicle,
  postVehicleSubmit,
];

export function createVehiclesRouter(service: VehiclesService): Router {
  const router = Router();
  for (const route of ROUTES) route(router, service);
  return router;
}
