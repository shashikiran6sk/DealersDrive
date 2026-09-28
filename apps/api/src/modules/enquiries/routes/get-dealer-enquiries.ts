import { DealerEnquiryQuery } from '@dealers-drive/contracts';

import { dealerPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import type { DealerEnquiriesRoute } from './dealer-route.js';
import { handle } from './handle.js';

export const getDealerEnquiries: DealerEnquiriesRoute = (router, service) => {
  router.get(
    '/enquiries',
    requirePermission('enquiry:read'),
    validate({ query: DealerEnquiryQuery }),
    handle((req) =>
      service.inbox(dealerPrincipal(req).dealerId, validated<DealerEnquiryQuery>(req, 'query')),
    ),
  );
};
