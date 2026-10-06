import { adminPrincipal, requirePermission } from '../../../middleware/auth.js';

import { handle, type SalesRoute } from './route.js';

export const getDashboard: SalesRoute = (router, { service }) => {
  router.get(
    '/dashboard',
    requirePermission('sales:dealer:read'),
    handle((req) => service.dashboard(adminPrincipal(req))),
  );
};
