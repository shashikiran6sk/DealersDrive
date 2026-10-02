import { AdminSupportTicketQuery } from '@dealers-drive/contracts';

import { adminPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import type { AdminSupportRoute } from './admin-route.js';
import { handle } from './handle.js';

export const getAdminTickets: AdminSupportRoute = (router, service) => {
  router.get(
    '/support/tickets',
    requirePermission('admin:support:manage'),
    validate({ query: AdminSupportTicketQuery }),
    handle((req) =>
      service.list(adminPrincipal(req), validated<AdminSupportTicketQuery>(req, 'query')),
    ),
  );
};
