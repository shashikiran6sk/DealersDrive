import {
  ApproveDealerInput,
  IdParam,
  type ApproveDealerInput as ApproveDealerInputType,
  type IdParam as IdParamType,
} from '@dealers-drive/contracts';

import { adminPrincipal } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type AdminRoute } from './route.js';

export const postDealerApprove: AdminRoute = (router, service) => {
  router.post(
    '/dealers/:id/approve',
    validate({ params: IdParam, body: ApproveDealerInput }),
    handle((req) =>
      service.approveDealer(
        adminPrincipal(req),
        validated<IdParamType>(req, 'params').id,
        validated<ApproveDealerInputType>(req, 'body'),
      ),
    ),
  );
};
