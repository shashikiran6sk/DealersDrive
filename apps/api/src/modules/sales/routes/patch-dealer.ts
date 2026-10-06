import { IdParam, UpdateAssistedDealerInput } from '@dealers-drive/contracts';

import { adminPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type SalesRoute } from './route.js';

export const patchDealer: SalesRoute = (router, { service }) => {
  router.patch(
    '/dealers/:id',
    requirePermission('sales:dealer:edit'),
    validate({ params: IdParam, body: UpdateAssistedDealerInput }),
    handle((req) =>
      service.update(
        adminPrincipal(req),
        validated<IdParam>(req, 'params').id,
        validated<UpdateAssistedDealerInput>(req, 'body'),
      ),
    ),
  );
};
