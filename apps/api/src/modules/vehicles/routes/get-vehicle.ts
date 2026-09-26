import { IdParam, type IdParam as IdParamType } from '@dealers-drive/contracts';

import { dealerPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type VehiclesRoute } from './route.js';

export const getVehicle: VehiclesRoute = (router, service) => {
  router.get(
    '/vehicles/:id',
    requirePermission('vehicle:read'),
    validate({ params: IdParam }),
    handle((req) =>
      service.get(dealerPrincipal(req).dealerId, validated<IdParamType>(req, 'params').id),
    ),
  );
};
