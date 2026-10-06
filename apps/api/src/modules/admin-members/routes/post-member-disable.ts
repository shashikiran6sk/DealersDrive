import { DisableAdminMemberInput, IdParam } from '@dealers-drive/contracts';

import { adminPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type AdminMembersRoute } from './route.js';

export const postMemberDisable: AdminMembersRoute = (router, service) => {
  router.post(
    '/members/:id/disable',
    requirePermission('admin:access:manage'),
    validate({ params: IdParam, body: DisableAdminMemberInput }),
    handle((req) =>
      service.disable(
        adminPrincipal(req),
        validated<IdParam>(req, 'params').id,
        validated<DisableAdminMemberInput>(req, 'body'),
      ),
    ),
  );
};
