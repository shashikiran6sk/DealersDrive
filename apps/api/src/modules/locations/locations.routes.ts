import { Router } from 'express';

import type { LocationsService } from './locations.service.js';

/** A12 — public, cached at the edge, no session anywhere. */
export function createLocationsRouter(service: LocationsService): Router {
  const router = Router();

  router.get('/cities', (_req, res, next) => {
    void (async () => {
      try {
        res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
        res.json(await service.cities());
      } catch (error) {
        next(error);
      }
    })();
  });

  return router;
}
