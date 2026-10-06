import { IdParam, SupportNoteInput } from '@dealers-drive/contracts';

import { adminPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import type { AdminSupportRoute } from './admin-route.js';
import { handle } from './handle.js';

export const postAdminTicketNote: AdminSupportRoute = (router, service) => {
  router.post(
    '/support/tickets/:id/notes',
    requirePermission('admin:support:manage'),
    validate({ params: IdParam, body: SupportNoteInput }),
    handle(
      (req) =>
        service.note(
          adminPrincipal(req),
          validated<IdParam>(req, 'params').id,
          validated<SupportNoteInput>(req, 'body'),
        ),
      201,
    ),
  );
};
