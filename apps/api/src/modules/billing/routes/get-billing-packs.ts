import { requirePermission } from '../../../middleware/auth.js';

import { handle, type BillingRoute } from './route.js';

export const getBillingPacks: BillingRoute = (router, service) => {
  router.get(
    '/billing/packs',
    requirePermission('billing:read'),
    handle(() => service.packs()),
  );
};
