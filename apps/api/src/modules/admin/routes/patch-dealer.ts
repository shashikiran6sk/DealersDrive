import {
  IdParam,
  UpdateDealerInput,
  type IdParam as IdParamType,
  type UpdateDealerInput as UpdateDealerInputType,
} from '@dealers-drive/contracts';

import { adminPrincipal } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type AdminRoute } from './route.js';

/**
 * The dealer's own answers, amended by the console.
 *
 * Deliberately the **same schema** `PATCH /v1/dealer` validates with. An admin
 * editing a dealership is editing a dealership: the fields, their bounds and the
 * normalisation behind them are properties of the data, not of who is holding
 * the pen. A separate `AdminUpdateDealerInput` would be a second place for the
 * GSTIN pattern to live, and the two would drift.
 */
export const patchDealer: AdminRoute = (router, service) => {
  router.patch(
    '/dealers/:id',
    validate({ params: IdParam, body: UpdateDealerInput }),
    handle((req) =>
      service.updateDealer(
        adminPrincipal(req),
        validated<IdParamType>(req, 'params').id,
        validated<UpdateDealerInputType>(req, 'body'),
      ),
    ),
  );
};
