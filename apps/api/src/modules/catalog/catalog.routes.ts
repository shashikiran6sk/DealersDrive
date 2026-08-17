import { Router } from 'express';

import type { CatalogService } from './catalog.service.js';

/** A13 · A12 · A14 — public, cached at the edge, no session anywhere. */
export function createCatalogRouter(service: CatalogService): Router {
  const router = Router();

  router.get('/catalog/bundle', (_req, res, next) => {
    void (async () => {
      try {
        res.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=600');
        res.json(await service.bundle());
      } catch (error) {
        next(error);
      }
    })();
  });

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
