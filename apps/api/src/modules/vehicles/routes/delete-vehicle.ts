import { IdParam, type IdParam as IdParamType } from '@dealers-drive/contracts';

import { requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { actorOf } from './actor.js';
import { handle, type VehiclesRoute } from './route.js';

export const deleteVehicle: VehiclesRoute = (router, service) => {
  router.delete(
    '/vehicles/:id',
    requirePermission('vehicle:delete'),
    validate({ params: IdParam }),
    handle((req) => service.remove(actorOf(req), validated<IdParamType>(req, 'params').id)),
  );
};
