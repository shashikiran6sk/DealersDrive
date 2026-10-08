import { IdParam } from '@dealers-drive/contracts';
import { dealerPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';
import { handle } from './handle.js';
import type { StorefrontRoute } from './route.js';

export const deleteDomain: StorefrontRoute = (router, { domains, rateLimit }) => {
  router.delete(
    '/storefront/domains/:id',
    requirePermission('storefront:domain'),
    rateLimit('storefront.domains.remove', {
      limit: 20,
      windowSeconds: 3600,
      failClosed: true,
      keyBy: (req) => dealerPrincipal(req).dealerId,
    }),
    validate({ params: IdParam }),
    handle(async (req, res) => {
      res.json(await domains.remove(dealerPrincipal(req), validated<IdParam>(req, 'params').id));
    }),
  );
};
