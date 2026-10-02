import { IdParam } from '@dealers-drive/contracts';

import { requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import type { AdminSupportRoute } from './admin-route.js';
import { handle } from './handle.js';

export const getAdminTicket: AdminSupportRoute = (router, service) => {
  router.get(
    '/support/tickets/:id',
    requirePermission('admin:support:manage'),
    validate({ params: IdParam }),
    handle((req) => service.detail(validated<IdParam>(req, 'params').id)),
  );
};
