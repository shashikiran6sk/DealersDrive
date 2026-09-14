import { adminPrincipal } from '../../../middleware/auth.js';

import { handle, type AdminRoute } from './route.js';

/**
 * Who may open this console (**R42**). The allow-list is the other half of the
 * answer and is deliberately not writable from here: it lives in the deployment,
 * and the list this returns says which rows came from where.
 */
export const getAccess: AdminRoute = (router, service) => {
  router.get(
    '/access',
    handle((req) => service.adminAccess(adminPrincipal(req))),
  );
};
