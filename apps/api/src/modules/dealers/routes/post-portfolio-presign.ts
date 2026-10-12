import {
  PortfolioPhotoPresignInput,
  type PortfolioPhotoPresignInput as PortfolioPhotoPresignInputType,
} from '@dealers-drive/contracts';

import { dealerPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { type DealersRoute } from './route.js';

export const postPortfolioPresign: DealersRoute = (router, service) => {
  router.post(
    '/portfolio/presign',
    requirePermission('dealer:update'),
    validate({ body: PortfolioPhotoPresignInput }),
    (req, res, next) => {
      void (async () => {
        try {
          const { dealerId } = dealerPrincipal(req);
          const body = validated<PortfolioPhotoPresignInputType>(req, 'body');
          res.status(201).json(await service.portfolio.presign(dealerId, body));
        } catch (error) {
          next(error);
        }
      })();
    },
  );
};
