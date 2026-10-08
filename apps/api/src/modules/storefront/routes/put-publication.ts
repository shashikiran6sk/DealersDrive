import { IdParam, SetPublicationInput } from '@dealers-drive/contracts';

import { dealerPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';
import { handle } from './handle.js';
import type { StorefrontRoute } from './route.js';

export const putPublication: StorefrontRoute = (router, { service }) => {
  router.put(
    '/storefront/publication/:id',
    requirePermission('storefront:manage'),
    validate({ params: IdParam, body: SetPublicationInput }),
    handle(async (req, res) => {
      await service.publication(
        dealerPrincipal(req),
        validated<IdParam>(req, 'params').id,
        validated<SetPublicationInput>(req, 'body'),
      );
      res.status(204).end();
    }),
  );
};
