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

/**
 * C14 — dealer-scoped media.
 *
 * Every route is `requirePermission`-guarded and takes its `dealerId` from the
 * session, never from the path: `/media/:id` is looked up as
 * `{ id, dealerId }`, so another tenant's upload reads as absent rather than
 * as forbidden.
 */
const MEDIA_ROUTES: MediaRoute[] = [postMediaPresign, postMediaCommit, getMedia, deleteMedia];

export function createMediaRouter(service: MediaService): Router {
  const router = Router();
  for (const route of MEDIA_ROUTES) route(router, { service });
  return router;
}

/**
 * The endpoints that stand in for R2 locally.
 *
 * `PUT /uploads` terminates the presigned upload: it verifies the HMAC, the
 * expiry, the declared content-type and the declared content-length before a
 * byte is written — the same conditions an S3 presigned PUT enforces. It is
 * mounted outside `/v1` because it is storage, not API surface.
 */
const STORAGE_ROUTES: StorageRoute[] = [putUploads, getMediaImage];

export function createStorageRouter(storage: StoragePort, service: MediaService): Router {
  const router = Router();
  for (const route of STORAGE_ROUTES) route(router, { storage, service });
  return router;
}
