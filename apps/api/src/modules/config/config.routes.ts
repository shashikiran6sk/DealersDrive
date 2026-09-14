import { Router } from 'express';

import type { ConfigService } from './config.service.js';
import { getConfigPublic } from './routes/get-config-public.js';
import type { ConfigRoute } from './routes/route.js';

/** A14 — public, cached at the edge, no session anywhere. */
const ROUTES: ConfigRoute[] = [getConfigPublic];

export function createConfigRouter(service: ConfigService): Router {
  const router = Router();
  for (const route of ROUTES) route(router, { service });
  return router;
}
