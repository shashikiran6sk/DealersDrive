import { ProgressiveAssistedRegistrationInput } from '@dealers-drive/contracts';

import { adminPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type SalesRoute } from './route.js';

export const postProgressiveDealer: SalesRoute = (router, { service }) => {
  router.post(
    '/dealers/register',
    requirePermission('sales:dealer:create'),
    validate({ body: ProgressiveAssistedRegistrationInput }),
    handle(
      (req) =>
        service.create(
          adminPrincipal(req),
          validated<ProgressiveAssistedRegistrationInput>(req, 'body'),
        ),
      201,
    ),
  );
};
