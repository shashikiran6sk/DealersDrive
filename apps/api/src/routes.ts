import { Router } from 'express';

import { env } from './config/env.js';
import type { Container } from './container.js';
import { createDocsRouter } from './docs/docs.routes.js';
import { createAdminRouter } from './modules/admin/admin.routes.js';
import { createCatalogRouter } from './modules/catalog/catalog.routes.js';
import { createAuthRouter, createDealersRouter } from './modules/dealers/dealers.routes.js';
import {
  createDealerEnquiriesRouter,
  createPublicEnquiriesRouter,
} from './modules/enquiries/enquiries.routes.js';
import { createBillingRouter } from './modules/billing/billing.routes.js';
import { createMediaRouter, createStorageRouter } from './modules/media/media.routes.js';
import { createSearchRouter } from './modules/search/search.routes.js';
import { createVehiclesRouter } from './modules/vehicles/vehicles.routes.js';
import { createHealthRouter } from './modules/health/health.routes.js';

/**
 * Every module router is mounted here and nowhere else — one file to read to
 * know the entire surface area of the API.
 *
 * The three mount points carry three different guard chains, and that is the
 * whole authorization model at a glance:
 *
 *   /v1/…          public, IP rate-limited, no principal
 *   /v1/dealer/…   requireDealer  — dealerId enters the request context here
 *   /v1/admin/…    requireAdmin
 *
 * Health lives outside /v1: infrastructure probes it, not clients, so it must
 * never move when the API version does. So does `/uploads`, which is storage
 * standing in for R2 rather than API surface, and `/api/docs`, which documents
 * every version rather than belonging to one.
 */
export function createRoutes(container: Container): Router {
  const router = Router();

  router.use('/health', createHealthRouter(container));
  router.use(createStorageRouter(container.storage, container.media));

  // The OpenAPI reference. Outside /v1 for the same reason /health is: it is not
  // versioned API surface. Off in production by default (`DOCS_ENABLED`), and
  // skipped under test so the suite does not pay to build it 7 times.
  if (env.DOCS_ENABLED) {
    router.use('/api/docs', createDocsRouter());
  }

  const v1 = Router();

  // ── public ────────────────────────────────────────────────────────────
  v1.use(createCatalogRouter(container.catalog));
  v1.use(createSearchRouter(container.search, container.dealersPublic));
  v1.use(createPublicEnquiriesRouter(container.enquiries));

  // ── dealer ────────────────────────────────────────────────────────────
  const dealer = Router();
  dealer.use(container.auth.requireDealer);
  dealer.use(createDealersRouter(container.dealers));
  dealer.use(createVehiclesRouter(container.vehicles));
  dealer.use(createMediaRouter(container.media));
  dealer.use(createDealerEnquiriesRouter(container.enquiries));
  dealer.use(createBillingRouter(container.billing, container.storage));
  v1.use('/dealer', dealer);

  // Scoped to `/auth`, not mounted at the v1 root: an unprefixed mount would
  // run requireDealer for every /v1 path that reached it, admin included.
  v1.use('/auth', container.auth.requireDealer, createAuthRouter(container.dealers));

  // ── admin ─────────────────────────────────────────────────────────────
  const admin = Router();
  admin.use(container.auth.requireAdmin);
  admin.use(createAdminRouter(container.admin));
  v1.use('/admin', admin);

  router.use('/v1', v1);

  return router;
}
