import { CreateAssistedDealerInput } from '@dealers-drive/contracts';

import { adminPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type SalesRoute } from './route.js';

export const postDealer: SalesRoute = (router, { service }) => {
  router.post(
    '/dealers',
    requirePermission('sales:dealer:create'),
    validate({ body: CreateAssistedDealerInput }),
    handle(
      (req) =>
        service.create(adminPrincipal(req), validated<CreateAssistedDealerInput>(req, 'body')),
      201,
    ),
  );
};
