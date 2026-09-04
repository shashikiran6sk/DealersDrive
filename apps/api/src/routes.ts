import { Router } from 'express';

import type { Container } from './container.js';
import { createPublicAuthRouter, createSessionAuthRouter } from './modules/auth/auth.routes.js';
import { createConfigRouter } from './modules/config/config.routes.js';
import { createHealthRouter } from './modules/health/health.routes.js';
import { createLocationsRouter } from './modules/locations/locations.routes.js';
import { createMediaRouter, createStorageRouter } from './modules/media/media.routes.js';

/**
 * Every module router is mounted here and nowhere else — one file to read to
 * know the entire surface area of the API.
 *
 * The mount points carry different guard chains, and that is the whole
 * authorization model at a glance:
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
 *
 * ── Reconstruction note ───────────────────────────────────────────────────
 * Health is mounted as of F006, auth and the two guarded chains as of
 * F016/F018, and `/uploads` plus the first router under `/v1/dealer` as of
 * F033. The docs router arrives with F096. `/v1/admin` still carries its guard
 * and no child routers: every router that goes under it belongs to a later
 * feature, and the guard is what that mount exists to establish.
 */
export function createRoutes(container: Container): Router {
  const router = Router();

  router.use('/health', createHealthRouter(container));
  router.use(createStorageRouter(container.storage, container.media));

  const v1 = Router();

  // ── public ────────────────────────────────────────────────────────────
  v1.use(createConfigRouter(container.publicConfig));
  v1.use(createLocationsRouter(container.locations));

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
  dealer.use(createMediaRouter(container.media));
  v1.use('/dealer', dealer);

  // ── admin ─────────────────────────────────────────────────────────────
  const admin = Router();
  admin.use(container.guards.requireAdmin);
  v1.use('/admin', admin);

  router.use('/v1', v1);

  return router;
}
