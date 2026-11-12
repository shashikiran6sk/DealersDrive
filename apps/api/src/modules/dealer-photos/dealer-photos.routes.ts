import { Router } from 'express';

import type { DealerPhotosService } from './dealer-photos.service.js';
import { deleteVehiclePhoto } from './routes/delete-vehicle-photo.js';
import { getVehiclePhotos } from './routes/get-vehicle-photos.js';
import { postVehiclePhotoCommit } from './routes/post-vehicle-photo-commit.js';
import { postVehiclePhotoPresign } from './routes/post-vehicle-photo-presign.js';
import { putVehiclePhotoPlan } from './routes/put-vehicle-photo-plan.js';
import type { DealerPhotosRoute } from './routes/route.js';

const ROUTES: DealerPhotosRoute[] = [
  getVehiclePhotos,
  putVehiclePhotoPlan,
  postVehiclePhotoPresign,
  postVehiclePhotoCommit,
  deleteVehiclePhoto,
];

export function createDealerPhotosRouter(service: DealerPhotosService): Router {
  const router = Router();
  for (const route of ROUTES) route(router, service);
  return router;
}
