import { IdParam, type IdParam as IdParamType } from '@dealers-drive/contracts';

import { dealerPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import type { MediaRoute } from './route.js';

export const getMedia: MediaRoute = (router, { service }) => {
  router.get(
    '/media/:id',
    requirePermission('vehicle:read'),
    validate({ params: IdParam }),
    (req, res, next) => {
      void (async () => {
        try {
          const { dealerId } = dealerPrincipal(req);
          const params = validated<IdParamType>(req, 'params');
          res.json(await service.get(dealerId, params.id));
        } catch (error) {
          next(error);
        }
      })();
    },
  );
};
