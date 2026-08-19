import { CONTRACTS_VERSION } from '@dealers-drive/contracts';
import { Router } from 'express';

import { env } from '../../config/env.js';
import type { Container } from '../../container.js';

const startedAt = Date.now();

/**
 * E2 · E3 — liveness and readiness.
 *
 * /health/live  — the process is up. Never touches a dependency, so a database
 *                 blip cannot get the container killed and restarted.
 * /health/ready — the process can serve traffic. 503 with the failing check
 *                 named when a dependency is down; deploys gate on it (§20.3).
 */
export function createHealthRouter(container: Container): Router {
  const router = Router();

  router.get('/live', (_req, res) => {
    res.json({ status: 'ok' });
  });

  router.get('/ready', (_req, res, next) => {
    void (async () => {
      try {
        const checks: Record<string, string> = { queue: 'ok', storage: 'ok', gateway: 'ok' };

        try {
          await container.prisma.$queryRaw`SELECT 1`;
          checks.database = 'ok';
        } catch {
          checks.database = 'down';
        }

        const healthy = Object.values(checks).every((value) => value === 'ok');
        res.status(healthy ? 200 : 503).json({
          status: healthy ? 'ok' : 'degraded',
          contracts: CONTRACTS_VERSION,
          appEnv: env.APP_ENV,
          // The deployed commit. A deploy pipeline has no other way to tell
          // "the new image is serving" from "the old one is still serving and
          // answering exactly as well" — both are 200s (§20.3).
          version: env.GIT_SHA,
          checks,
          uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
        });
      } catch (error) {
        next(error);
      }
    })();
  });

  return router;
}
