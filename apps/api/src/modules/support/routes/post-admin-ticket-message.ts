import { IdParam, SupportMessageInput } from '@dealers-drive/contracts';

import { adminPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import type { AdminSupportRoute } from './admin-route.js';
import { handle } from './handle.js';

export const postAdminTicketMessage: AdminSupportRoute = (router, service) => {
  router.post(
    '/support/tickets/:id/messages',
    requirePermission('admin:support:manage'),
    validate({ params: IdParam, body: SupportMessageInput }),
    handle(
      (req) =>
        service.reply(
          adminPrincipal(req),
          validated<IdParam>(req, 'params').id,
          validated<SupportMessageInput>(req, 'body'),
        ),
      201,
    ),
  );
};
