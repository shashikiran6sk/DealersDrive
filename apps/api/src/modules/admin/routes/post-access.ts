import {
  GrantAdminAccessInput,
  type GrantAdminAccessInput as GrantAdminAccessInputType,
} from '@dealers-drive/contracts';

import { adminPrincipal } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type AdminRoute } from './route.js';

export const postAccess: AdminRoute = (router, service) => {
  router.post(
    '/access',
    validate({ body: GrantAdminAccessInput }),
    handle(
      (req) =>
        service.grantAdminAccess(
          adminPrincipal(req),
          validated<GrantAdminAccessInputType>(req, 'body'),
        ),
      201,
    ),
  );
};
