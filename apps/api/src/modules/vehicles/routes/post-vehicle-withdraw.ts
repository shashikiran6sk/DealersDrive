import {
  IdParam,
  WithdrawListingInput,
  type IdParam as IdParamType,
  type WithdrawListingInput as WithdrawListingInputType,
} from '@dealers-drive/contracts';

import { requireDealerActive, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { actorOf } from './actor.js';
import { handle, type VehiclesRoute } from './route.js';

export const postVehicleWithdraw: VehiclesRoute = (router, service) => {
  router.post(
    '/vehicles/:id/withdraw',
    requirePermission('listing:submit'),
    requireDealerActive,
    validate({ params: IdParam, body: WithdrawListingInput }),
    handle((req) =>
      service.lifecycle(
        actorOf(req),
        validated<IdParamType>(req, 'params').id,
        'withdraw',
        validated<WithdrawListingInputType>(req, 'body'),
      ),
    ),
  );
};
