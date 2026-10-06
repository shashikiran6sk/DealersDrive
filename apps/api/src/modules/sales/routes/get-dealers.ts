import { SalesDealersQuery } from '@dealers-drive/contracts';

import { adminPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type SalesRoute } from './route.js';

export const getDealers: SalesRoute = (router, { service }) => {
  router.get(
    '/dealers',
    requirePermission('sales:dealer:read'),
    validate({ query: SalesDealersQuery }),
    handle((req) =>
      service.dealers(adminPrincipal(req), validated<SalesDealersQuery>(req, 'query')),
    ),
  );
};
