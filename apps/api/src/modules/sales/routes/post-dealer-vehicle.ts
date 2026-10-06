import { CreateVehicleInput, IdParam } from '@dealers-drive/contracts';

import { adminPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type SalesRoute } from './route.js';

export const postDealerVehicle: SalesRoute = (router, { service }) => {
  router.post(
    '/dealers/:id/vehicles',
    requirePermission('sales:listing:create'),
    validate({ params: IdParam, body: CreateVehicleInput }),
    handle(
      (req) =>
        service.createVehicle(
          adminPrincipal(req),
          validated<IdParam>(req, 'params').id,
          validated<CreateVehicleInput>(req, 'body'),
        ),
      201,
    ),
  );
};
