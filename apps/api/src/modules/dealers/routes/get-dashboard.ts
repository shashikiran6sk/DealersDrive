import { dealerPrincipal } from '../../../middleware/auth.js';

import { type DealersRoute } from './route.js';

export const getDashboard: DealersRoute = (router, service) => {
  router.get('/dashboard', (req, res, next) => {
    void (async () => {
      try {
        const { dealerId, userId } = dealerPrincipal(req);
        res.set('Cache-Control', 'no-store');
        res.json(await service.dashboard(dealerId, userId));
      } catch (error) {
        next(error);
      }
    })();
  });
};
