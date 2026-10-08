import { Router } from 'express';

import type { RateLimiter } from '../../middleware/rate-limit.js';
import { getManagement } from './routes/get-management.js';
import { postManagement } from './routes/post-management.js';
import { patchBranding } from './routes/patch-branding.js';
import { putEnabled } from './routes/put-enabled.js';
import { putPublication } from './routes/put-publication.js';
import { getPreview } from './routes/get-preview.js';
import { getSite } from './routes/get-site.js';
import { getCars } from './routes/get-cars.js';
import { getCar } from './routes/get-car.js';
import { postIntent } from './routes/post-intent.js';
import { getIntent } from './routes/get-intent.js';
import type { StorefrontService } from './storefront.service.js';
import type { StorefrontMediaService } from './storefront.media.js';
import { postMediaPresign } from './routes/post-media-presign.js';
import { postMediaCommit } from './routes/post-media-commit.js';
import { getMediaPreview } from './routes/get-media-preview.js';
import { getSitemap } from './routes/get-sitemap.js';

export function createStorefrontManagementRouter(
  service: StorefrontService,
  rateLimit: RateLimiter,
  media: StorefrontMediaService,
): Router {
  const router = Router();
  for (const route of [
    getManagement,
    postManagement,
    patchBranding,
    putEnabled,
    putPublication,
    getPreview,
    postMediaPresign,
    postMediaCommit,
    getMediaPreview,
  ])
    route(router, { service, rateLimit, media });
  return router;
}
export function createStorefrontPublicRouter(
  service: StorefrontService,
  rateLimit: RateLimiter,
  media: StorefrontMediaService,
): Router {
  const router = Router();
  router.use('/storefront', rateLimit('storefront.public', { limit: 240, windowSeconds: 60 }));
  for (const route of [getSite, getCars, getCar, postIntent, getIntent, getSitemap])
    route(router, { service, rateLimit, media });
  return router;
}
