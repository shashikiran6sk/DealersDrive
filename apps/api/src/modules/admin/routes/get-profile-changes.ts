import { adminPrincipal } from '../../../middleware/auth.js';

import { handle, type AdminRoute } from './route.js';

export const getProfileChanges: AdminRoute = (router, service) => {
  router.get(
    '/profile-changes',
    handle((req) => service.profileChanges(adminPrincipal(req))),
  );
};
