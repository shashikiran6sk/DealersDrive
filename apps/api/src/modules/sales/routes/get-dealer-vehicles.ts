import { IdParam } from '@dealers-drive/contracts';

import { adminPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type SalesRoute } from './route.js';

export const getDealerVehicles: SalesRoute = (router, { service }) => {
  router.get(
    '/dealers/:id/vehicles',
    requirePermission('sales:listing:read'),
    validate({ params: IdParam }),
    handle((req) => service.vehicles(adminPrincipal(req), validated<IdParam>(req, 'params').id)),
  );
};
