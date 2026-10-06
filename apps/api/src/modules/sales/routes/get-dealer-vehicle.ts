import { SalesVehicleParam } from '@dealers-drive/contracts';

import { adminPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type SalesRoute } from './route.js';

export const getDealerVehicle: SalesRoute = (router, { service }) => {
  router.get(
    '/dealers/:id/vehicles/:vehicleId',
    requirePermission('sales:listing:read'),
    validate({ params: SalesVehicleParam }),
    handle((req) => {
      const params = validated<SalesVehicleParam>(req, 'params');
      return service.vehicle(adminPrincipal(req), params.id, params.vehicleId);
    }),
  );
};
