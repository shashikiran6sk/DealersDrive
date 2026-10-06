import { IdParam } from '@dealers-drive/contracts';

import { adminPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type AdminMembersRoute } from './route.js';

export const postMemberActivate: AdminMembersRoute = (router, service) => {
  router.post(
    '/members/:id/activate',
    requirePermission('admin:access:manage'),
    validate({ params: IdParam }),
    handle((req) => service.activate(adminPrincipal(req), validated<IdParam>(req, 'params').id)),
  );
};
