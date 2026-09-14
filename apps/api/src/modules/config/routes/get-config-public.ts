import type { ConfigRoute } from './route.js';

export const getConfigPublic: ConfigRoute = (router, { service }) => {
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
};
