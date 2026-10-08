import { AddStorefrontDomainInput } from '@dealers-drive/contracts';
import { dealerPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';
import { handle } from './handle.js';
import type { StorefrontRoute } from './route.js';

export const postDomain: StorefrontRoute = (router, { domains, rateLimit }) => {
  router.post(
    '/storefront/domains',
    requirePermission('storefront:domain'),
    rateLimit('storefront.domains', {
      limit: 20,
      windowSeconds: 3600,
      failClosed: true,
      keyBy: (req) => dealerPrincipal(req).dealerId,
    }),
    validate({ body: AddStorefrontDomainInput }),
    handle(async (req, res) => {
      res
        .status(201)
        .json(
          await domains.add(
            dealerPrincipal(req),
            validated<AddStorefrontDomainInput>(req, 'body').hostname,
          ),
        );
    }),
  );
};
