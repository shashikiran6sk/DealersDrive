import { IdParam } from '@dealers-drive/contracts';

import { adminPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type AdminMembersRoute } from './route.js';

export const getMemberHistory: AdminMembersRoute = (router, service) => {
  router.get(
    '/members/:id/history',
    requirePermission('admin:access:manage'),
    validate({ params: IdParam }),
    handle((req) => service.history(adminPrincipal(req), validated<IdParam>(req, 'params').id)),
  );
};
