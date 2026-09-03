import { Router } from 'express';

import type { Container } from './container.js';

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
 * F002 lands the mount table with nothing mounted on it. The `/v1` router
 * exists so the versioning boundary is established before anything depends on
 * it. Health arrives at F006, auth at F018, the dealer and admin chains with
 * their guards at F016.
 */
export function createRoutes(_container: Container): Router {
  const router = Router();

  const v1 = Router();

  router.use('/v1', v1);

  return router;
}
