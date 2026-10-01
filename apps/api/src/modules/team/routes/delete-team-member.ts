import { IdParam } from '@dealers-drive/contracts';

import { requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { actorOf } from './actor.js';
import { handle } from './handle.js';
import type { TeamRoute } from './route.js';

export const deleteTeamMember: TeamRoute = (router, service) => {
  router.delete(
    '/team/members/:id',
    requirePermission('member:manage'),
    validate({ params: IdParam }),
    handle((req) => service.removeMember(actorOf(req), validated<IdParam>(req, 'params').id)),
  );
};
