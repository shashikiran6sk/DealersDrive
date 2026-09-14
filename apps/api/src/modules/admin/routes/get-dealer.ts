import { IdParam, type IdParam as IdParamType } from '@dealers-drive/contracts';

import { adminPrincipal } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type AdminRoute } from './route.js';

export const getDealer: AdminRoute = (router, service) => {
  router.get(
    '/dealers/:id',
    validate({ params: IdParam }),
    handle((req) =>
      service.dealerDetail(adminPrincipal(req), validated<IdParamType>(req, 'params').id),
    ),
  );
};
