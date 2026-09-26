import {
  IdParam,
  ReasonInput,
  type IdParam as IdParamType,
  type ReasonInput as ReasonInputType,
} from '@dealers-drive/contracts';

import { adminPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type ModerationRoute } from './route.js';

export const postListingReject: ModerationRoute = (router, service) => {
  router.post(
    '/listings/:id/reject',
    requirePermission('admin:listing:moderate'),
    validate({ params: IdParam, body: ReasonInput }),
    handle((req) =>
      service.reject(
        adminPrincipal(req),
        validated<IdParamType>(req, 'params').id,
        validated<ReasonInputType>(req, 'body').reason,
      ),
    ),
  );
};
