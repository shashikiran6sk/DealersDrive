import { requirePermission } from '../../../middleware/auth.js';

import { actorOf } from './actor.js';
import { handle } from './handle.js';
import type { TeamRoute } from './route.js';

export const getTeam: TeamRoute = (router, service) => {
  router.get(
    '/team',
    requirePermission('member:manage'),
    handle((req) => {
      const { dealerId, userId } = actorOf(req);
      return service.team(dealerId, userId);
    }),
  );
};
