import type { PublicDealersRoute } from './route.js';

/*
 * The places, for the header's location button.
 *
 * Mounted before `/dealers/:slug` is irrelevant — it is a different path —
 * but it is deliberately **not** `/dealers/locations`, which would be: Express
 * matches in definition order, and a resource whose correctness depends on
 * sitting above a wildcard is one line away from becoming a dealership called
 * "locations".
 */
export const getLocations: PublicDealersRoute = (router, { service, publicReads }) => {
  router.get('/locations', publicReads, (_req, res, next) => {
    void (async () => {
      try {
        // The same five minutes the directory gets, and for the same reason:
        // this changes at the pace of onboarding, not of trading.
        res.set('Cache-Control', 'public, max-age=300');
        res.json(await service.locations());
      } catch (error) {
        next(error);
      }
    })();
  });
};
