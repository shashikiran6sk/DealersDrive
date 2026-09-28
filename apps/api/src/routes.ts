import { Router } from 'express';

import { env } from './config/env.js';
import type { Container } from './container.js';
import { createDocsRouter } from './docs/docs.routes.js';
import {
  createCustomerAuthRouter,
  createPublicAuthRouter,
  createSessionAuthRouter,
} from './modules/auth/auth.routes.js';
import { createDealerEnquiriesRouter } from './modules/enquiries/enquiries.dealer.routes.js';
import { createEnquiriesRouter } from './modules/enquiries/enquiries.routes.js';
import { createAdminRouter } from './modules/admin/admin.routes.js';
import { createConfigRouter } from './modules/config/config.routes.js';
import { createPublicDealersRouter } from './modules/dealers/dealers.public.routes.js';
import { createDealersRouter } from './modules/dealers/dealers.routes.js';
import { createHealthRouter } from './modules/health/health.routes.js';
import { createStorageRouter } from './modules/media/media.routes.js';
import { createModerationRouter } from './modules/moderation/moderation.routes.js';
import { createSearchRouter } from './modules/search/search.routes.js';
import { createVehicleImagesRouter } from './modules/vehicle-images/vehicle-images.routes.js';
import { createVehiclesRouter } from './modules/vehicles/vehicles.routes.js';
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
  v1.use(createSearchRouter(container.search, container.rateLimit));

  v1.use(
    '/auth',
    createPublicAuthRouter(
      container.auth,
      container.phoneSignIn,
      container.customers,
      container.rateLimit,
    ),
  );
  v1.use(
    '/auth/customer',
    container.guards.requireCustomer,
    createCustomerAuthRouter(container.customers),
  );
  v1.use(
    '/enquiries',
    container.guards.requireCustomer,
    createEnquiriesRouter(container.enquiries, container.rateLimit),
  );
  v1.use(
    '/auth',
    container.guards.requireSignedIn,
    createSessionAuthRouter(container.auth, container.phone, container.rateLimit),
  );

  const dealer = Router();
  dealer.use(container.guards.requireDealer);
  dealer.use(createDealersRouter(container.dealers));
  dealer.use(createVehiclesRouter(container.vehicles));
  dealer.use(createDealerEnquiriesRouter(container.enquiries));
  v1.use('/dealer', dealer);

  const admin = Router();
  admin.use(container.guards.requireAdmin);
  admin.use(createAdminRouter(container.admin));
  admin.use(createModerationRouter(container.moderation));
  admin.use(createVehicleImagesRouter(container.vehicleImages));
  v1.use('/admin', admin);

  router.use('/v1', v1);

  return router;
}
