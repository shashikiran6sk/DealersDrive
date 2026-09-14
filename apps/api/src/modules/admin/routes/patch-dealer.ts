import {
  IdParam,
  UpdateDealerInput,
  type IdParam as IdParamType,
  type UpdateDealerInput as UpdateDealerInputType,
} from '@dealers-drive/contracts';

import { adminPrincipal } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type AdminRoute } from './route.js';

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
