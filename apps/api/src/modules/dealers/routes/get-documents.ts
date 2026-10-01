import { dealerPrincipal, requirePermission } from '../../../middleware/auth.js';

import { type DealersRoute } from './route.js';

export const getDocuments: DealersRoute = (router, service) => {
  router.get('/documents', requirePermission('document:upload'), (req, res, next) => {
    void (async () => {
      try {
        const { dealerId } = dealerPrincipal(req);
        res.json(await service.documents(dealerId));
      } catch (error) {
        next(error);
      }
    })();
  });
};
