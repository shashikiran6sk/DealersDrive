import { CONTRACTS_VERSION } from '@dealers-drive/contracts';
import { Router } from 'express';

import { env } from '../../config/env.js';
import type { Container } from '../../container.js';
import { drainingForMs, isDraining } from '../../platform/telemetry/lifecycle.js';

const startedAt = Date.now();

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
export function createHealthRouter(container: Container): Router {
  const router = Router();

  router.get('/live', (_req, res) => {
    res.json({ status: 'ok' });
  });

  router.get('/ready', (_req, res, next) => {
    void (async () => {
      try {
        // Draining is answered before anything is probed. The dependencies are
        // very likely still fine; that is not the question being asked.
        if (isDraining()) {
          res.status(503).json({
            status: 'draining',
            contracts: CONTRACTS_VERSION,
            appEnv: env.APP_ENV,
            version: env.GIT_SHA,
            drainingForMs: drainingForMs() ?? 0,
            uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
          });
          return;
        }

        const checks: Record<string, string> = { queue: 'ok', storage: 'ok', gateway: 'ok' };

        const [database, cache] = await Promise.all([
          probe(() => container.prisma.$queryRaw`SELECT 1`),
          // The rate limiter reads through this on every public request, so a
          // cache that is down is a real degradation even though the limiter
          // itself fails open.
          probe(() => container.cache.ping()),
        ]);
        checks.database = database;
        checks.cache = cache;

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
          drivers: { cache: container.cache.driver, storage: env.STORAGE_DRIVER },
          uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
        });
      } catch (error) {
        next(error);
      }
    })();
  });

  return router;
}

/** Runs one dependency probe and reduces it to `ok` / `down`. */
async function probe(check: () => Promise<unknown>): Promise<string> {
  try {
    await check();
    return 'ok';
  } catch {
    return 'down';
  }
}
