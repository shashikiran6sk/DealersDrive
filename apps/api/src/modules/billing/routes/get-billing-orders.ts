import { requirePermission } from '../../../middleware/auth.js';

import { billingActorOf } from './actor.js';
import { handle, type BillingRoute } from './route.js';

export const getBillingOrders: BillingRoute = (router, service) => {
  router.get(
    '/billing/orders',
    requirePermission('billing:read'),
    handle((req) => service.orders(billingActorOf(req).dealerId)),
  );
};
