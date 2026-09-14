import { IdParam, type IdParam as IdParamType } from '@dealers-drive/contracts';

import { adminPrincipal } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type AdminRoute } from './route.js';

/**
 * Keyed by the change rather than by the dealership, the way the document
 * decisions are: the thing being decided on has an id, and addressing it by
 * `/dealers/:id/profile-change` would make "which edit" a question the server
 * answers by guessing at the newest one — exactly wrong when a dealer saves again
 * while a moderator has the page open.
 */
export const postProfileChangeApprove: AdminRoute = (router, service) => {
  router.post(
    '/profile-changes/:id/approve',
    validate({ params: IdParam }),
    handle((req) =>
      service.approveProfileChange(adminPrincipal(req), validated<IdParamType>(req, 'params').id),
    ),
  );
};
