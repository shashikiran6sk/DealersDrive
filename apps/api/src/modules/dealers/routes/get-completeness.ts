import { dealerPrincipal } from '../../../middleware/auth.js';

import { type DealersRoute } from './route.js';

export const getCompleteness: DealersRoute = (router, service) => {
  router.get('/completeness', (req, res, next) => {
    void (async () => {
      try {
        const { dealerId } = dealerPrincipal(req);
        res.json(await service.completeness(dealerId));
      } catch (error) {
        next(error);
      }
    })();
  });
};
