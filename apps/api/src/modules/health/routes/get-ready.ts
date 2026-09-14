import { CONTRACTS_VERSION } from '@dealers-drive/contracts';

import { drainingForMs, isDraining } from '../../../platform/telemetry/lifecycle.js';
import { env } from '../../../config/env.js';

import type { HealthRoute } from './route.js';
import { probe, startedAt } from './uptime.js';

export const getReady: HealthRoute = (router, container) => {
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
};
