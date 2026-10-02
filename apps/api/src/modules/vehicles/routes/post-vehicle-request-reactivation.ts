import {
  IdParam,
  RequestReactivationInput,
  type IdParam as IdParamType,
  type RequestReactivationInput as RequestReactivationInputType,
} from '@dealers-drive/contracts';

import { requireDealerActive, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { actorOf } from './actor.js';
import { handle, type VehiclesRoute } from './route.js';

export const postVehicleRequestReactivation: VehiclesRoute = (router, service) => {
  router.post(
    '/vehicles/:id/request-reactivation',
    requirePermission('listing:reactivate'),
    requireDealerActive,
    validate({ params: IdParam, body: RequestReactivationInput }),
    handle((req) =>
      service.requestReactivation(
        actorOf(req),
        validated<IdParamType>(req, 'params').id,
        validated<RequestReactivationInputType>(req, 'body'),
      ),
    ),
  );
};
