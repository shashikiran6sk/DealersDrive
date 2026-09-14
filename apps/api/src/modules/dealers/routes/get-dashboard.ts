import { dealerPrincipal } from '../../../middleware/auth.js';

import { type DealersRoute } from './route.js';

/**
 * C18 — the console landing page (**F048**).
 *
 * No permission: `requireDealer` has already run, and a salesperson who
 * cannot see their own dashboard has a broken console. The tenant scope still
 * comes from the principal, so nothing here is unscoped.
 *
 * `no-store`, and the credit balance is why. Every other read on this router
 * is a profile a dealer is looking at; this one carries a number they are
 * about to spend, and a stale balance is worse than a slow one.
 */
export const getDashboard: DealersRoute = (router, service) => {
  router.get('/dashboard', (req, res, next) => {
    void (async () => {
      try {
        const { dealerId } = dealerPrincipal(req);
        res.set('Cache-Control', 'no-store');
        res.json(await service.dashboard(dealerId));
      } catch (error) {
        next(error);
      }
    })();
  });
};
