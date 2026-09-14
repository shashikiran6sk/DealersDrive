import { adminPrincipal } from '../../../middleware/auth.js';

import { handle, type AdminRoute } from './route.js';

export const getAccess: AdminRoute = (router, service) => {
  router.get(
    '/access',
    handle((req) => service.adminAccess(adminPrincipal(req))),
  );
};
