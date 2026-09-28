import { Router } from 'express';

import { deleteVehicle } from './routes/delete-vehicle.js';
import { getVehicle } from './routes/get-vehicle.js';
import { getVehicleSuggestions } from './routes/get-vehicle-suggestions.js';
import { getVehicles } from './routes/get-vehicles.js';
import { patchVehicle } from './routes/patch-vehicle.js';
import { postVehicle } from './routes/post-vehicle.js';
import { postVehicleMarkSold } from './routes/post-vehicle-mark-sold.js';
import { postVehicleReactivate } from './routes/post-vehicle-reactivate.js';
import { postVehicleRelist } from './routes/post-vehicle-relist.js';
import { postVehicleReserve } from './routes/post-vehicle-reserve.js';
import { postVehicleSubmit } from './routes/post-vehicle-submit.js';
import { postVehicleWithdraw } from './routes/post-vehicle-withdraw.js';
import type { VehiclesRoute } from './routes/route.js';
import type { VehiclesService } from './vehicles.service.js';

const ROUTES: VehiclesRoute[] = [
  getVehicles,
  postVehicle,
  getVehicleSuggestions,
  getVehicle,
  patchVehicle,
  deleteVehicle,
  postVehicleSubmit,
  postVehicleReserve,
  postVehicleReactivate,
  postVehicleMarkSold,
  postVehicleWithdraw,
  postVehicleRelist,
];

export function createVehiclesRouter(service: VehiclesService): Router {
  const router = Router();
  for (const route of ROUTES) route(router, service);
  return router;
}
