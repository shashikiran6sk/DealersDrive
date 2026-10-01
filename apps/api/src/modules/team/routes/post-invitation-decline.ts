import { IdParam } from '@dealers-drive/contracts';

import { customerPrincipal } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle } from './handle.js';
import type { InvitationsRoute } from './route.js';

export const postInvitationDecline: InvitationsRoute = (router, service) => {
  router.post(
    '/:id/decline',
    validate({ params: IdParam }),
    handle((req) => service.decline(customerPrincipal(req), validated<IdParam>(req, 'params').id)),
  );
};
