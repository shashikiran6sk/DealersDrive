import { dealerPrincipal } from '../../../middleware/auth.js';

import { type DealersRoute } from './route.js';

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
