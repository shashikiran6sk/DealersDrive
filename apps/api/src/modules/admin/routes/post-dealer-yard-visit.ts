import {
  CreateYardVisitInput,
  IdParam,
  type CreateYardVisitInput as CreateYardVisitInputType,
  type IdParam as IdParamType,
} from '@dealers-drive/contracts';

import { adminPrincipal } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type AdminRoute } from './route.js';

export const postDealerYardVisit: AdminRoute = (router, service) => {
  router.post(
    '/dealers/:id/yard-visits',
    validate({ params: IdParam, body: CreateYardVisitInput }),
    handle(
      (req) =>
        service.yardVisits.create(
          adminPrincipal(req),
          validated<IdParamType>(req, 'params').id,
          validated<CreateYardVisitInputType>(req, 'body'),
        ),
      201,
    ),
  );
};
