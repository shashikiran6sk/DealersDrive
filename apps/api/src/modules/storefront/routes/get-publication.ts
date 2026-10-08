import { StorefrontPublicationQuery } from '@dealers-drive/contracts';
import { dealerPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';
import { handle } from './handle.js';
import type { StorefrontRoute } from './route.js';

export const getPublication: StorefrontRoute = (router, { service }) => {
  router.get(
    '/storefront/publication',
    requirePermission('storefront:read'),
    validate({ query: StorefrontPublicationQuery }),
    handle(async (req, res) => {
      res.json(
        await service.publications(
          dealerPrincipal(req),
          validated<StorefrontPublicationQuery>(req, 'query').page,
        ),
      );
    }),
  );
};
