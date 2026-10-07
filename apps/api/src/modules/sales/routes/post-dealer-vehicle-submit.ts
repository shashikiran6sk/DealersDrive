import { SalesVehicleParam } from '@dealers-drive/contracts';

import { adminPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type SalesRoute } from './route.js';

export const postDealerVehicleSubmit: SalesRoute = (router, { service }) => {
  router.post(
    '/dealers/:id/vehicles/:vehicleId/submit',
    requirePermission('sales:listing:submit'),
    validate({ params: SalesVehicleParam }),
    handle((req) => {
      const params = validated<SalesVehicleParam>(req, 'params');
      return service.submitVehicle(adminPrincipal(req), params.id, params.vehicleId);
    }),
  );
};
