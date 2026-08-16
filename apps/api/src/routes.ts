import { Router } from 'express';

import type { Container } from './container.js';
import { createHealthRouter } from './modules/health/health.routes.js';

/**
 * Every module router is mounted here and nowhere else — one file to read to
 * know the entire surface area of the API.
 *
 * Health lives outside /v1: infrastructure probes it, not clients, so it must
 * never move when the API version does.
 */
export function createRoutes(container: Container): Router {
  const router = Router();

  router.use('/health', createHealthRouter(container));

  const v1 = Router();

  // Day 6+ — mounted from the container, each module exposing exactly one router:
  //   v1.use(container.auth.router);
  //   v1.use(container.dealers.router);
  //   v1.use(container.vehicles.router);
  //   ...

  router.use('/v1', v1);

  return router;
}
