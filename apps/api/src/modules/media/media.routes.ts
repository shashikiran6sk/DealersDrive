import { Router } from 'express';

import type { StoragePort } from '../../platform/storage/storage.port.js';
import type { MediaService } from './media.service.js';
import { getMediaImage } from './routes/get-media-image.js';
import { getPrivate } from './routes/get-private.js';
import { putUploads } from './routes/put-uploads.js';
import type { StorageRoute } from './routes/route.js';

const STORAGE_ROUTES: StorageRoute[] = [putUploads, getPrivate, getMediaImage];

export function createStorageRouter(storage: StoragePort, service: MediaService): Router {
  const router = Router();
  for (const route of STORAGE_ROUTES) route(router, { storage, service });
  return router;
}
