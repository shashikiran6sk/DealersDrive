import { IdParam, type IdParam as IdParamType } from '@dealers-drive/contracts';
import { adminPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';
import { handle, type ModerationRoute } from './route.js';

export const postListingMarkSold: ModerationRoute = (router, service) => {
  router.post(
    '/listings/:id/mark-sold',
    requirePermission('admin:listing:moderate'),
    validate({ params: IdParam }),
    handle((req) =>
      service.lifecycle(adminPrincipal(req), validated<IdParamType>(req, 'params').id, 'markSold'),
    ),
  );
};
