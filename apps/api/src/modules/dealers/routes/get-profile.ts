import { dealerPrincipal } from '../../../middleware/auth.js';

import { type DealersRoute } from './route.js';

export const getProfile: DealersRoute = (router, service) => {
  router.get('/', (req, res, next) => {
    void (async () => {
      try {
        const { dealerId } = dealerPrincipal(req);
        res.json(await service.profile(dealerId));
      } catch (error) {
        next(error);
      }
    })();
  });
};
