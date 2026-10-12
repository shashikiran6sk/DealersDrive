import { IdParam, type IdParam as IdParamType } from '@dealers-drive/contracts';

import { adminPrincipal } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type AdminRoute } from './route.js';

export const getDealerYardVisits: AdminRoute = (router, service) => {
  router.get(
    '/dealers/:id/yard-visits',
    validate({ params: IdParam }),
    handle((req) =>
      service.yardVisits.list(adminPrincipal(req), validated<IdParamType>(req, 'params').id),
    ),
  );
};
