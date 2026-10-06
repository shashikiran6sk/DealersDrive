import { IdParam, UpdateAdminMemberInput } from '@dealers-drive/contracts';

import { adminPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type AdminMembersRoute } from './route.js';

export const patchMember: AdminMembersRoute = (router, service) => {
  router.patch(
    '/members/:id',
    requirePermission('admin:access:manage'),
    validate({ params: IdParam, body: UpdateAdminMemberInput }),
    handle((req) =>
      service.changeRole(
        adminPrincipal(req),
        validated<IdParam>(req, 'params').id,
        validated<UpdateAdminMemberInput>(req, 'body'),
      ),
    ),
  );
};
