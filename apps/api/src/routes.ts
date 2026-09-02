import { Router } from 'express';

import { env } from './config/env.js';
import type { Container } from './container.js';
import { createDocsRouter } from './docs/docs.routes.js';
import { createAdminRouter } from './modules/admin/admin.routes.js';
import { createPublicAuthRouter, createSessionAuthRouter } from './modules/auth/auth.routes.js';
import { createCatalogRouter } from './modules/catalog/catalog.routes.js';
import { createDealersRouter } from './modules/dealers/dealers.routes.js';
import {
  createDealerEnquiriesRouter,
  createPublicEnquiriesRouter,
} from './modules/enquiries/enquiries.routes.js';
import { createBillingRouter } from './modules/billing/billing.routes.js';
import { createMediaRouter, createStorageRouter } from './modules/media/media.routes.js';
import { createSearchRouter } from './modules/search/search.routes.js';
import { createReportsRouter } from './modules/reports/reports.routes.js';
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
 *   /v1/auth/…     mixed, and the only mount where that is true — sign-in has
 *                  to be reachable without a session, and `/me` must not be
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
  v1.use(createSearchRouter(container.search, container.dealersPublic, container.rateLimit));
  v1.use(createPublicEnquiriesRouter(container.enquiries, container.rateLimit));

  // ── auth ──────────────────────────────────────────────────────────────
  // Two routers on one prefix, in this order. The first answers the paths that
  // must work without a session — sign-in cannot require being signed in — and
  // falls through for everything else; the second guards what is left. Order is
  // the security boundary here: swapping these two lines would leave
  // `/onboarding` open.
  v1.use('/auth', createPublicAuthRouter(container.auth, container.rateLimit));
  v1.use('/auth', container.guards.requireSignedIn, createSessionAuthRouter(container.auth));

  // ── dealer ────────────────────────────────────────────────────────────
  const dealer = Router();
  dealer.use(container.guards.requireDealer);
  dealer.use(createDealersRouter(container.dealers));
  dealer.use(createVehiclesRouter(container.vehicles, container.rateLimit));
  dealer.use(createReportsRouter(container.vehicles, container.rateLimit));
  dealer.use(createMediaRouter(container.media));
  dealer.use(createDealerEnquiriesRouter(container.enquiries));
  dealer.use(createBillingRouter(container.billing, container.storage, container.rateLimit));
  v1.use('/dealer', dealer);

  // ── admin ─────────────────────────────────────────────────────────────
  const admin = Router();
  admin.use(container.guards.requireAdmin);
  admin.use(createAdminRouter(container.admin));
  v1.use('/admin', admin);

  router.use('/v1', v1);

  return router;
}
