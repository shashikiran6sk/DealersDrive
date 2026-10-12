import { dealerPrincipal, requirePermission } from '../../../middleware/auth.js';

import { type DealersRoute } from './route.js';

export const getPortfolio: DealersRoute = (router, service) => {
  router.get('/portfolio', requirePermission('dealer:update'), (req, res, next) => {
    void (async () => {
      try {
        const { dealerId } = dealerPrincipal(req);
        res.json(await service.portfolio.list(dealerId));
      } catch (error) {
        next(error);
      }
    })();
  });
};
