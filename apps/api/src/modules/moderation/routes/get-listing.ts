import { IdParam, type IdParam as IdParamType } from '@dealers-drive/contracts';

import { adminPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type ModerationRoute } from './route.js';

export const getListing: ModerationRoute = (router, service) => {
  router.get(
    '/listings/:id',
    requirePermission('admin:listing:moderate'),
    validate({ params: IdParam }),
    handle((req) => service.detail(validated<IdParamType>(req, 'params').id, adminPrincipal(req))),
  );
};
