import {
  IdParam,
  SetPhotoPlanInput,
  type IdParam as IdParamType,
  type SetPhotoPlanInput as SetPhotoPlanInputType,
} from '@dealers-drive/contracts';

import { requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { photoActorOf } from './actor.js';
import { handle, type DealerPhotosRoute } from './route.js';

export const putVehiclePhotoPlan: DealerPhotosRoute = (router, service) => {
  router.put(
    '/vehicles/:id/photo-plan',
    requirePermission('vehicle:write'),
    validate({ params: IdParam, body: SetPhotoPlanInput }),
    handle((req) =>
      service.setPlan(
        photoActorOf(req),
        validated<IdParamType>(req, 'params').id,
        validated<SetPhotoPlanInputType>(req, 'body').plan,
      ),
    ),
  );
};
