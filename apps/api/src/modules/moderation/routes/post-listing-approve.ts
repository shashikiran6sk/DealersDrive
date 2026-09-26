import { IdParam, type IdParam as IdParamType } from '@dealers-drive/contracts';

import { adminPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type ModerationRoute } from './route.js';

export const postListingApprove: ModerationRoute = (router, service) => {
  router.post(
    '/listings/:id/approve',
    requirePermission('admin:listing:moderate'),
    validate({ params: IdParam }),
    handle((req) => service.approve(adminPrincipal(req), validated<IdParamType>(req, 'params').id)),
  );
};
