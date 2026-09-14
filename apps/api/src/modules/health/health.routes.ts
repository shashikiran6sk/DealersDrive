import { Router } from 'express';

import type { Container } from '../../container.js';
import { getLive } from './routes/get-live.js';
import { getReady } from './routes/get-ready.js';
import type { HealthRoute } from './routes/route.js';

/**
 * E2 · E3 — liveness and readiness.
 *
 * /health/live  — the process is up. Never touches a dependency, and never
 *                 fails during a graceful drain: a liveness probe that goes
 *                 red while the task is finishing its in-flight work gets the
 *                 container killed mid-drain (§20.10).
 * /health/ready — the process can serve *new* traffic. 503 with the failing
 *                 check named when a dependency is down, and 503 immediately
 *                 on SIGTERM so the target group stops routing to this task
 *                 before the listener closes. Deploys gate on it (§20.3).
 */
const ROUTES: HealthRoute[] = [getLive, getReady];

export function createHealthRouter(container: Container): Router {
  const router = Router();
  for (const route of ROUTES) route(router, container);
  return router;
}
