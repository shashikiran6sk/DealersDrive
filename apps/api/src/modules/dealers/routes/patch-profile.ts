import {
  DealerSelfUpdateInput,
  type DealerSelfUpdateInput as DealerSelfUpdateInputType,
} from '@dealers-drive/contracts';

import { dealerPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { type DealersRoute } from './route.js';

export const patchProfile: DealersRoute = (router, service) => {
  router.patch(
    '/',
    requirePermission('dealer:update'),
    validate({ body: DealerSelfUpdateInput }),
    (req, res, next) => {
      void (async () => {
        try {
          const { dealerId, userId } = dealerPrincipal(req);
          const body = validated<DealerSelfUpdateInputType>(req, 'body');
          res.json(await service.selfUpdate(dealerId, userId, body));
        } catch (error) {
          next(error);
        }
      })();
    },
  );
};
