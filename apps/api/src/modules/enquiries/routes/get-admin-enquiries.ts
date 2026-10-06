import { AdminEnquiryQuery } from '@dealers-drive/contracts';

import { requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import type { AdminEnquiriesRoute } from './admin-route.js';
import { handle } from './handle.js';

export const getAdminEnquiries: AdminEnquiriesRoute = (router, service) => {
  router.get(
    '/enquiries',
    requirePermission('admin:enquiry:read'),
    validate({ query: AdminEnquiryQuery }),
    handle((req) => service.list(validated<AdminEnquiryQuery>(req, 'query'))),
  );
};
