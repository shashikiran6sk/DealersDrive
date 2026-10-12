import { IdParam, VerifyAssistedDealerInput } from '@dealers-drive/contracts';

import { adminPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type SalesRoute } from './route.js';

export const postDealerVerify: SalesRoute = (router, { service }) => {
  router.post(
    '/dealers/:id/verify',
    requirePermission('sales:dealer:edit'),
    validate({ params: IdParam, body: VerifyAssistedDealerInput }),
    handle((req) =>
      service.verifyExisting(
        adminPrincipal(req),
        validated<IdParam>(req, 'params').id,
        validated<VerifyAssistedDealerInput>(req, 'body'),
      ),
    ),
  );
};
