import { adminPrincipal } from '../../../middleware/auth.js';

import { handle, type AdminRoute } from './route.js';

/**
 * D3b — the profile edits waiting for a decision (**R34**).
 *
 * A queue of its own rather than a filter on the dealer list, because it is work
 * rather than a property of a dealership: oldest first, and every row carries
 * what is live beside what is proposed so a moderator can decide without opening
 * the dealership. The dealer list carries `?pendingEdits=true` as well, for the
 * moderator who arrives from the other direction.
 */
export const getProfileChanges: AdminRoute = (router, service) => {
  router.get(
    '/profile-changes',
    handle((req) => service.profileChanges(adminPrincipal(req))),
  );
};
