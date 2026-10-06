import { Router } from 'express';

import { env, type Env } from '../../config/env.js';
import type { StoragePort } from '../../platform/storage/storage.port.js';
import type { MediaService } from './media.service.js';
import { getMediaImage } from './routes/get-media-image.js';
import { getPrivate } from './routes/get-private.js';
import { putUploads } from './routes/put-uploads.js';
import type { StorageRoute } from './routes/route.js';

const LOCAL_STAND_INS: StorageRoute[] = [putUploads, getPrivate];
const PUBLIC_MEDIA: StorageRoute[] = [getMediaImage];

export function storageRoutesFor(driver: Env['STORAGE_DRIVER']): StorageRoute[] {
  return driver === 'local' ? [...LOCAL_STAND_INS, ...PUBLIC_MEDIA] : PUBLIC_MEDIA;
}

export function createStorageRouter(
  storage: StoragePort,
  service: MediaService,
  driver: Env['STORAGE_DRIVER'] = env.STORAGE_DRIVER,
): Router {
  const router = Router();
  for (const route of storageRoutesFor(driver)) route(router, { storage, service });
  return router;
}
