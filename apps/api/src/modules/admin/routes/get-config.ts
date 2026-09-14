import { adminPrincipal } from '../../../middleware/auth.js';

import { handle, type AdminRoute } from './route.js';

export const getConfig: AdminRoute = (router, service) => {
  router.get(
    '/config',
    handle((req) => service.config(adminPrincipal(req))),
  );
};
