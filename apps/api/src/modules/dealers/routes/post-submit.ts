import { dealerPrincipal, requirePermission } from '../../../middleware/auth.js';

import { type DealersRoute } from './route.js';

export const postSubmit: DealersRoute = (router, service) => {
  router.post('/submit', requirePermission('dealer:update'), (req, res, next) => {
    void (async () => {
      try {
        const { dealerId, userId } = dealerPrincipal(req);
        res.json(await service.submitForVerification(dealerId, { type: 'DEALER', id: userId }));
      } catch (error) {
        next(error);
      }
    })();
  });
};
