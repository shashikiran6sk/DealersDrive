import { dealerPrincipal } from '../../../middleware/auth.js';
import type { DealersRoute } from './route.js';
export const getProgressive: DealersRoute = (router, service) => {
  router.get('/progressive', (req, res, next) => {
    void service
      .progressiveState(dealerPrincipal(req).dealerId)
      .then((value) => res.json(value))
      .catch(next);
  });
};
