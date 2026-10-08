import { SubmitVehicleInput } from '@dealers-drive/contracts';
import { IdParam, type IdParam as IdParamType } from '@dealers-drive/contracts';

import { requireDealerActive, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { actorOf } from './actor.js';
import { handle, type VehiclesRoute } from './route.js';

export const postVehicleSubmit: VehiclesRoute = (router, service) => {
  router.post(
    '/vehicles/:id/submit',
    requirePermission('listing:submit'),
    requireDealerActive,
    validate({ params: IdParam, body: SubmitVehicleInput.optional().default({}) }),
    handle((req) =>
      service.submit(
        actorOf(req),
        validated<IdParamType>(req, 'params').id,
        validated<SubmitVehicleInput>(req, 'body'),
      ),
    ),
  );
};
