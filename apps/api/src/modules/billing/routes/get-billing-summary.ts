import { requirePermission } from '../../../middleware/auth.js';

import { billingActorOf } from './actor.js';
import { handle, type BillingRoute } from './route.js';

export const getBillingSummary: BillingRoute = (router, service) => {
  router.get(
    '/billing/summary',
    requirePermission('vehicle:read'),
    handle((req) => {
      const actor = billingActorOf(req);
      return service.summary(actor.dealerId, actor.permissions);
    }),
  );
};
