import { IdParam } from '@dealers-drive/contracts';

import { requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { actorOf } from './actor.js';
import { handle } from './handle.js';
import type { TeamRoute } from './route.js';

export const deleteTeamInvitation: TeamRoute = (router, service) => {
  router.delete(
    '/team/invitations/:id',
    requirePermission('member:manage'),
    validate({ params: IdParam }),
    handle((req) => service.revokeInvitation(actorOf(req), validated<IdParam>(req, 'params').id)),
  );
};
