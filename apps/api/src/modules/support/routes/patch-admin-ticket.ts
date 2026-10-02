import { IdParam, UpdateSupportTicketInput } from '@dealers-drive/contracts';

import { adminPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import type { AdminSupportRoute } from './admin-route.js';
import { handle } from './handle.js';

export const patchAdminTicket: AdminSupportRoute = (router, service) => {
  router.patch(
    '/support/tickets/:id',
    requirePermission('admin:support:manage'),
    validate({ params: IdParam, body: UpdateSupportTicketInput }),
    handle((req) =>
      service.update(
        adminPrincipal(req),
        validated<IdParam>(req, 'params').id,
        validated<UpdateSupportTicketInput>(req, 'body'),
      ),
    ),
  );
};
