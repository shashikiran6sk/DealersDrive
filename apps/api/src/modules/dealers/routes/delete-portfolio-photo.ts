import {
  PortfolioPhotoParam,
  type PortfolioPhotoParam as PortfolioPhotoParamType,
} from '@dealers-drive/contracts';

import { dealerPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { type DealersRoute } from './route.js';

export const deletePortfolioPhoto: DealersRoute = (router, service) => {
  router.delete(
    '/portfolio/:id',
    requirePermission('dealer:update'),
    validate({ params: PortfolioPhotoParam }),
    (req, res, next) => {
      void (async () => {
        try {
          const { dealerId, userId } = dealerPrincipal(req);
          const params = validated<PortfolioPhotoParamType>(req, 'params');
          await service.portfolio.remove(dealerId, userId, params.id);
          res.status(204).end();
        } catch (error) {
          next(error);
        }
      })();
    },
  );
};
