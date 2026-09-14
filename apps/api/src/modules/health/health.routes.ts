import { Router } from 'express';

import type { Container } from '../../container.js';
import { getLive } from './routes/get-live.js';
import { getReady } from './routes/get-ready.js';
import type { HealthRoute } from './routes/route.js';

const ROUTES: HealthRoute[] = [getLive, getReady];

export function createHealthRouter(container: Container): Router {
  const router = Router();
  for (const route of ROUTES) route(router, container);
  return router;
}
