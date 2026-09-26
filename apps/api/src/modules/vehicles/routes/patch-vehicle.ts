import {
  IdParam,
  UpdateVehicleInput,
  type IdParam as IdParamType,
  type UpdateVehicleInput as UpdateVehicleInputType,
} from '@dealers-drive/contracts';

import { requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { actorOf } from './actor.js';
import { handle, type VehiclesRoute } from './route.js';

export const patchVehicle: VehiclesRoute = (router, service) => {
  router.patch(
    '/vehicles/:id',
    requirePermission('vehicle:write'),
    validate({ params: IdParam, body: UpdateVehicleInput }),
    handle((req) =>
      service.update(
        actorOf(req),
        validated<IdParamType>(req, 'params').id,
        validated<UpdateVehicleInputType>(req, 'body'),
      ),
    ),
  );
};
