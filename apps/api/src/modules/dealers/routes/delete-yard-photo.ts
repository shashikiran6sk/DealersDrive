import { dealerPrincipal, requirePermission } from '../../../middleware/auth.js';

import { type DealersRoute } from './route.js';

export const deleteYardPhoto: DealersRoute = (router, service) => {
  router.delete('/yard-photo', requirePermission('document:upload'), (req, res, next) => {
    void (async () => {
      try {
        const { dealerId } = dealerPrincipal(req);
        await service.deleteYardPhoto(dealerId);
        res.status(204).end();
      } catch (error) {
        next(error);
      }
    })();
  });
};
