import {
  IdParam,
  ReasonInput,
  type IdParam as IdParamType,
  type ReasonInput as ReasonInputType,
} from '@dealers-drive/contracts';

import { adminPrincipal } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type AdminRoute } from './route.js';

export const postDealerRequestChanges: AdminRoute = (router, service) => {
  router.post(
    '/dealers/:id/request-changes',
    validate({ params: IdParam, body: ReasonInput }),
    handle((req) =>
      service.requestChanges(
        adminPrincipal(req),
        validated<IdParamType>(req, 'params').id,
        validated<ReasonInputType>(req, 'body').reason,
      ),
    ),
  );
};
