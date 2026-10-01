import { IdParam } from '@dealers-drive/contracts';

import { requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import type { AdminEnquiriesRoute } from './admin-route.js';
import { handle } from './handle.js';

export const getAdminEnquiry: AdminEnquiriesRoute = (router, service) => {
  router.get(
    '/enquiries/:id',
    requirePermission('admin:enquiry:read'),
    validate({ params: IdParam }),
    handle((req) => service.detail(validated<IdParam>(req, 'params').id)),
  );
};
