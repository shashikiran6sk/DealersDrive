import { adminPrincipal } from '../../../middleware/auth.js';

import { handle, type AdminRoute } from './route.js';

export const getMetricsOverview: AdminRoute = (router, service) => {
  router.get(
    '/metrics/overview',
    handle((req) => service.overview(adminPrincipal(req))),
  );
};
