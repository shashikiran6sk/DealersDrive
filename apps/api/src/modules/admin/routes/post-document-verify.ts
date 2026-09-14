import { IdParam, type IdParam as IdParamType } from '@dealers-drive/contracts';

import { adminPrincipal } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type AdminRoute } from './route.js';

export const postDocumentVerify: AdminRoute = (router, service) => {
  router.post(
    '/documents/:id/verify',
    validate({ params: IdParam }),
    handle((req) =>
      service.verifyDocument(adminPrincipal(req), validated<IdParamType>(req, 'params').id),
    ),
  );
};
