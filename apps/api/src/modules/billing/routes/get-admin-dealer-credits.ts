import { IdParam, type IdParam as IdParamType } from '@dealers-drive/contracts';

import { adminPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type BillingRoute } from './route.js';

export const getAdminDealerCredits: BillingRoute = (router, service) => {
  router.get(
    '/dealers/:id/credits',
    requirePermission('admin:payment:read'),
    validate({ params: IdParam }),
    handle((req) =>
      service.adminCredits(adminPrincipal(req), validated<IdParamType>(req, 'params').id),
    ),
  );
};
