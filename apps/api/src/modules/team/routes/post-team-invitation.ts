import { InviteMemberInput } from '@dealers-drive/contracts';

import { requireDealerActive, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { actorOf } from './actor.js';
import { handle } from './handle.js';
import type { TeamRoute } from './route.js';

export const postTeamInvitation: TeamRoute = (router, service) => {
  router.post(
    '/team/invitations',
    requirePermission('member:manage'),
    requireDealerActive,
    validate({ body: InviteMemberInput }),
    handle((req) => service.invite(actorOf(req), validated<InviteMemberInput>(req, 'body')), 201),
  );
};
