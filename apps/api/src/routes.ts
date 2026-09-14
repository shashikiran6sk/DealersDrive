import { Router } from 'express';

import { env } from './config/env.js';
import type { Container } from './container.js';
import { createDocsRouter } from './docs/docs.routes.js';
import { createPublicAuthRouter, createSessionAuthRouter } from './modules/auth/auth.routes.js';
import { createAdminRouter } from './modules/admin/admin.routes.js';
import { createConfigRouter } from './modules/config/config.routes.js';
import { createPublicDealersRouter } from './modules/dealers/dealers.public.routes.js';
import { createDealersRouter } from './modules/dealers/dealers.routes.js';
import { createHealthRouter } from './modules/health/health.routes.js';
import { createMediaRouter, createStorageRouter } from './modules/media/media.routes.js';
import { createMetricsRouter } from './platform/telemetry/metrics.routes.js';

export function createRoutes(container: Container): Router {
  const router = Router();

  if (env.METRICS_ENABLED) {
    router.use(createMetricsRouter(env.METRICS_SCRAPE_TOKEN!));
  }

  router.use('/health', createHealthRouter(container));
  router.use(createStorageRouter(container.storage, container.media));

  if (env.DOCS_ENABLED) {
    router.use('/api/docs', createDocsRouter());
  }

  const v1 = Router();

  v1.use(createConfigRouter(container.publicConfig));
  v1.use(createPublicDealersRouter(container.dealersPublic, container.rateLimit));

  v1.use('/auth', createPublicAuthRouter(container.auth));
  v1.use(
    '/auth',
    container.guards.requireSignedIn,
    createSessionAuthRouter(container.auth, container.phone, container.rateLimit),
  );

  const dealer = Router();
  dealer.use(container.guards.requireDealer);
  dealer.use(createDealersRouter(container.dealers));
  dealer.use(createMediaRouter(container.media));
  v1.use('/dealer', dealer);

  const admin = Router();
  admin.use(container.guards.requireAdmin);
  admin.use(createAdminRouter(container.admin));
  v1.use('/admin', admin);

  router.use('/v1', v1);

  return router;
}
