import {
  IdParam,
  ReasonInput,
  type IdParam as IdParamType,
  type ReasonInput as ReasonInputType,
} from '@dealers-drive/contracts';

import { adminPrincipal } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type AdminRoute } from './route.js';

export const postDealerSuspend: AdminRoute = (router, service) => {
  router.post(
    '/dealers/:id/suspend',
    validate({ params: IdParam, body: ReasonInput }),
    handle((req) =>
      service.suspendDealer(
        adminPrincipal(req),
        validated<IdParamType>(req, 'params').id,
        validated<ReasonInputType>(req, 'body').reason,
      ),
    ),
  );
};
