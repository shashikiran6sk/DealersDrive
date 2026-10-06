import { InviteAdminMemberInput } from '@dealers-drive/contracts';

import { adminPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type AdminMembersRoute } from './route.js';

export const postMember: AdminMembersRoute = (router, service) => {
  router.post(
    '/members',
    requirePermission('admin:access:manage'),
    validate({ body: InviteAdminMemberInput }),
    handle(
      (req) => service.invite(adminPrincipal(req), validated<InviteAdminMemberInput>(req, 'body')),
      201,
    ),
  );
};
