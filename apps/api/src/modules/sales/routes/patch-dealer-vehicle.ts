import { SalesVehicleParam, UpdateVehicleInput } from '@dealers-drive/contracts';

import { adminPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type SalesRoute } from './route.js';

export const patchDealerVehicle: SalesRoute = (router, { service }) => {
  router.patch(
    '/dealers/:id/vehicles/:vehicleId',
    requirePermission('sales:listing:edit'),
    validate({ params: SalesVehicleParam, body: UpdateVehicleInput }),
    handle((req) => {
      const params = validated<SalesVehicleParam>(req, 'params');
      return service.updateVehicle(
        adminPrincipal(req),
        params.id,
        params.vehicleId,
        validated<UpdateVehicleInput>(req, 'body'),
      );
    }),
  );
};
