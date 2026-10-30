import { AdminCallLeadQuery } from '@dealers-drive/contracts';

import { requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import type { AdminEnquiriesRoute } from './admin-route.js';
import { handle } from './handle.js';

export const getAdminCallLeads: AdminEnquiriesRoute = (router, service) => {
  router.get(
    '/call-leads',
    requirePermission('admin:enquiry:read'),
    validate({ query: AdminCallLeadQuery }),
    handle((req) => service.callLeads(validated<AdminCallLeadQuery>(req, 'query'))),
  );
};
