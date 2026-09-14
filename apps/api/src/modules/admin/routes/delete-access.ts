import { IdParam, type IdParam as IdParamType } from '@dealers-drive/contracts';

import { adminPrincipal } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type AdminRoute } from './route.js';

export const deleteAccess: AdminRoute = (router, service) => {
  router.delete(
    '/access/:id',
    validate({ params: IdParam }),
    handle(async (req) => {
      await service.revokeAdminAccess(
        adminPrincipal(req),
        validated<IdParamType>(req, 'params').id,
      );
      return undefined;
    }),
  );
};
