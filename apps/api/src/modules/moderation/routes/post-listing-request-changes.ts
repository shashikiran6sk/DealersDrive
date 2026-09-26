import {
  IdParam,
  ReasonInput,
  type IdParam as IdParamType,
  type ReasonInput as ReasonInputType,
} from '@dealers-drive/contracts';

import { adminPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type ModerationRoute } from './route.js';

export const postListingRequestChanges: ModerationRoute = (router, service) => {
  router.post(
    '/listings/:id/request-changes',
    requirePermission('admin:listing:moderate'),
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
