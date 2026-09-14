import type { PublicDealersRoute } from './route.js';

export const getLocations: PublicDealersRoute = (router, { service, publicReads }) => {
  router.get('/locations', publicReads, (_req, res, next) => {
    void (async () => {
      try {
        res.set('Cache-Control', 'public, max-age=300');
        res.json(await service.locations());
      } catch (error) {
        next(error);
      }
    })();
  });
};
