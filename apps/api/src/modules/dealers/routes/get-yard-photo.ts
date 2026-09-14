import { dealerPrincipal } from '../../../middleware/auth.js';

import { type DealersRoute } from './route.js';

export const getYardPhoto: DealersRoute = (router, service) => {
  router.get('/yard-photo', (req, res, next) => {
    void (async () => {
      try {
        const { dealerId } = dealerPrincipal(req);
        res.json(await service.yardPhoto(dealerId));
      } catch (error) {
        next(error);
      }
    })();
  });
};
