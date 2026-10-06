import { IdParam } from '@dealers-drive/contracts';

import { adminPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type SalesRoute } from './route.js';

export const deleteDealerYardPhoto: SalesRoute = (router, { service }) => {
  router.delete(
    '/dealers/:id/yard-photo',
    requirePermission('sales:dealer:edit'),
    validate({ params: IdParam }),
    handle((req) =>
      service.deleteYardPhoto(adminPrincipal(req), validated<IdParam>(req, 'params').id),
    ),
  );
};
