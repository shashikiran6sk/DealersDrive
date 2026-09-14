import { Router } from 'express';

import type { StoragePort } from '../../platform/storage/storage.port.js';
import type { MediaService } from './media.service.js';
import { deleteMedia } from './routes/delete-media.js';
import { getMedia } from './routes/get-media.js';
import { getMediaImage } from './routes/get-media-image.js';
import { postMediaCommit } from './routes/post-media-commit.js';
import { postMediaPresign } from './routes/post-media-presign.js';
import { putUploads } from './routes/put-uploads.js';
import type { MediaRoute, StorageRoute } from './routes/route.js';

const MEDIA_ROUTES: MediaRoute[] = [postMediaPresign, postMediaCommit, getMedia, deleteMedia];

export function createMediaRouter(service: MediaService): Router {
  const router = Router();
  for (const route of MEDIA_ROUTES) route(router, { service });
  return router;
}

const STORAGE_ROUTES: StorageRoute[] = [putUploads, getMediaImage];

export function createStorageRouter(storage: StoragePort, service: MediaService): Router {
  const router = Router();
  for (const route of STORAGE_ROUTES) route(router, { storage, service });
  return router;
}
