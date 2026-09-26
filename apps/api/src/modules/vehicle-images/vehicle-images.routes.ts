import { Router } from 'express';

import { deleteListingImage } from './routes/delete-listing-image.js';
import { postListingImageCommit } from './routes/post-listing-image-commit.js';
import { postListingImagePresign } from './routes/post-listing-image-presign.js';
import { putListingImagePrimary } from './routes/put-listing-image-primary.js';
import { putListingImagesOrder } from './routes/put-listing-images-order.js';
import type { VehicleImagesRoute } from './routes/route.js';
import type { VehicleImagesService } from './vehicle-images.service.js';

const ROUTES: VehicleImagesRoute[] = [
  postListingImagePresign,
  postListingImageCommit,
  putListingImagesOrder,
  putListingImagePrimary,
  deleteListingImage,
];

export function createVehicleImagesRouter(service: VehicleImagesService): Router {
  const router = Router();
  for (const route of ROUTES) route(router, service);
  return router;
}
