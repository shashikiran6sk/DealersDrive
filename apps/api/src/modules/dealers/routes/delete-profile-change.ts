import { dealerPrincipal, requirePermission } from '../../../middleware/auth.js';

import { type DealersRoute } from './route.js';

export const deleteProfileChange: DealersRoute = (router, service) => {
  router.delete('/profile-change', requirePermission('dealer:update'), (req, res, next) => {
    void (async () => {
      try {
        const { dealerId, userId } = dealerPrincipal(req);
        res.json(await service.withdrawProfileChange(dealerId, userId));
      } catch (error) {
        next(error);
      }
    })();
  });
};
