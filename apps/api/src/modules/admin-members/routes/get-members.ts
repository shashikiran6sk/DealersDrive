import { AdminMembersQuery } from '@dealers-drive/contracts';

import { adminPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type AdminMembersRoute } from './route.js';

export const getMembers: AdminMembersRoute = (router, service) => {
  router.get(
    '/members',
    requirePermission('admin:access:manage'),
    validate({ query: AdminMembersQuery }),
    handle((req) => service.list(adminPrincipal(req), validated<AdminMembersQuery>(req, 'query'))),
  );
};
