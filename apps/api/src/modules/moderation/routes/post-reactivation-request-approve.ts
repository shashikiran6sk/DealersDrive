import {
  IdParam,
  NoteInput,
  type IdParam as IdParamType,
  type NoteInput as NoteInputType,
} from '@dealers-drive/contracts';

import { adminPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type ModerationRoute } from './route.js';

export const postReactivationRequestApprove: ModerationRoute = (router, service) => {
  router.post(
    '/reactivation-requests/:id/approve',
    requirePermission('admin:listing:moderate'),
    validate({ params: IdParam, body: NoteInput }),
    handle((req) =>
      service.approveReactivation(
        adminPrincipal(req),
        validated<IdParamType>(req, 'params').id,
        validated<NoteInputType>(req, 'body').note,
      ),
    ),
  );
};
