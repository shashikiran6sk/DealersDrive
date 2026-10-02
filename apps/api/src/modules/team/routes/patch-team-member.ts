import { IdParam, UpdateMemberInput } from '@dealers-drive/contracts';

import { requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { actorOf } from './actor.js';
import { handle } from './handle.js';
import type { TeamRoute } from './route.js';

export const patchTeamMember: TeamRoute = (router, service) => {
  router.patch(
    '/team/members/:id',
    requirePermission('member:manage'),
    validate({ params: IdParam, body: UpdateMemberInput }),
    handle((req) =>
      service.updateMember(
        actorOf(req),
        validated<IdParam>(req, 'params').id,
        validated<UpdateMemberInput>(req, 'body'),
      ),
    ),
  );
};
