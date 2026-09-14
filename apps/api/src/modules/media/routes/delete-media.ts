import { IdParam, type IdParam as IdParamType } from '@dealers-drive/contracts';

import { dealerPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import type { MediaRoute } from './route.js';

export const deleteMedia: MediaRoute = (router, { service }) => {
  router.delete(
    '/media/:id',
    requirePermission('vehicle:write'),
    validate({ params: IdParam }),
    (req, res, next) => {
      void (async () => {
        try {
          const { dealerId } = dealerPrincipal(req);
          const params = validated<IdParamType>(req, 'params');
          await service.remove(dealerId, params.id);
          res.status(204).end();
        } catch (error) {
          next(error);
        }
      })();
    },
  );
};
