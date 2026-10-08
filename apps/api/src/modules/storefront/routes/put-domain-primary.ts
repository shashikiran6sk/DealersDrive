import { IdParam } from '@dealers-drive/contracts';
import { dealerPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';
import { handle } from './handle.js';
import type { StorefrontRoute } from './route.js';

export const putDomainPrimary: StorefrontRoute = (router, { domains }) => {
  router.put(
    '/storefront/domains/:id/primary',
    requirePermission('storefront:domain'),
    validate({ params: IdParam }),
    handle(async (req, res) => {
      res.json(await domains.primary(dealerPrincipal(req), validated<IdParam>(req, 'params').id));
    }),
  );
};
