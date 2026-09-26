import {
  CreateVehicleInput,
  type CreateVehicleInput as CreateVehicleInputType,
} from '@dealers-drive/contracts';

import { requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { actorOf } from './actor.js';
import { handle, type VehiclesRoute } from './route.js';

export const postVehicle: VehiclesRoute = (router, service) => {
  router.post(
    '/vehicles',
    requirePermission('vehicle:write'),
    validate({ body: CreateVehicleInput }),
    handle(
      (req) => service.create(actorOf(req), validated<CreateVehicleInputType>(req, 'body')),
      201,
    ),
  );
};
