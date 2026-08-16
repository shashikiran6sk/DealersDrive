import { Router } from 'express';

import { env } from '../../config/env.js';
import type { Container } from '../../container.js';

/**
 * Liveness and readiness.
 *
 * /health/live  — the process is up. Never touches a dependency, so a database
 *                 blip cannot get the container killed and restarted.
 * /health/ready — the process can serve traffic. Day 3 adds a `SELECT 1`
 *                 against Postgres here; Render gates deploys on it.
 */
export function createHealthRouter(_container: Container): Router {
  const router = Router();

  router.get('/live', (_req, res) => {
    res.json({ status: 'ok' });
  });

  router.get('/ready', (_req, res) => {
    res.json({ status: 'ok' });
  });

  if (!env.isProduction) {
    // Acceptance check for the error handler: an unexpected throw must come
    // back as a 500 Problem Details body, never an Express HTML error page.
    router.get('/boom', () => {
      throw new Error('test');
    });
  }

  return router;
}
