import { CallLeadQuery } from '@dealers-drive/contracts';

import { dealerPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import type { DealerEnquiriesRoute } from './dealer-route.js';
import { handle } from './handle.js';

export const getDealerCallLeads: DealerEnquiriesRoute = (router, service) => {
  router.get(
    '/call-leads',
    requirePermission('enquiry:read'),
    validate({ query: CallLeadQuery }),
    handle((req) =>
      service.callLeads(dealerPrincipal(req).dealerId, validated<CallLeadQuery>(req, 'query')),
    ),
  );
};
