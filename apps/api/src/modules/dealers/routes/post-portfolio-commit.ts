import {
  PortfolioPhotoCommitInput,
  type PortfolioPhotoCommitInput as PortfolioPhotoCommitInputType,
} from '@dealers-drive/contracts';

import { dealerPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { type DealersRoute } from './route.js';

export const postPortfolioCommit: DealersRoute = (router, service) => {
  router.post(
    '/portfolio/commit',
    requirePermission('dealer:update'),
    validate({ body: PortfolioPhotoCommitInput }),
    (req, res, next) => {
      void (async () => {
        try {
          const { dealerId, userId } = dealerPrincipal(req);
          const body = validated<PortfolioPhotoCommitInputType>(req, 'body');
          res.status(201).json(await service.portfolio.commit(dealerId, userId, body));
        } catch (error) {
          next(error);
        }
      })();
    },
  );
};
