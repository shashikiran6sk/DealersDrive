import { customerPrincipal } from '../../../middleware/auth.js';

import { handle } from './handle.js';
import type { InvitationsRoute } from './route.js';

export const getMyInvitations: InvitationsRoute = (router, service) => {
  router.get(
    '/',
    handle((req) => service.mine(customerPrincipal(req))),
  );
};
