import { IdParam } from '@dealers-drive/contracts';

import { adminPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type SalesRoute } from './route.js';

export const getDealer: SalesRoute = (router, { service }) => {
  router.get(
    '/dealers/:id',
    requirePermission('sales:dealer:read'),
    validate({ params: IdParam }),
    handle((req) => service.detail(adminPrincipal(req), validated<IdParam>(req, 'params').id)),
  );
};
