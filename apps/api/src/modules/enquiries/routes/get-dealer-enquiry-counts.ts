import { dealerPrincipal, requirePermission } from '../../../middleware/auth.js';

import type { DealerEnquiriesRoute } from './dealer-route.js';
import { handle } from './handle.js';

export const getDealerEnquiryCounts: DealerEnquiriesRoute = (router, service) => {
  router.get(
    '/enquiries/counts',
    requirePermission('enquiry:read'),
    handle((req) => service.counts(dealerPrincipal(req).dealerId)),
  );
};
