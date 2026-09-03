import { Router } from 'express';

import type { ConfigService } from './config.service.js';

/** A14 — public, cached at the edge, no session anywhere. */
export function createConfigRouter(service: ConfigService): Router {
  const router = Router();

  router.get('/config/public', (_req, res, next) => {
    void (async () => {
      try {
        res.set('Cache-Control', 'public, max-age=60');
        res.json(await service.publicConfig());
      } catch (error) {
        next(error);
      }
    })();
  });

  return router;
}
