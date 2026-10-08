import { IdParam } from '@dealers-drive/contracts';
import { dealerPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';
import { handle } from './handle.js';
import type { StorefrontRoute } from './route.js';

export const postDomainRefresh: StorefrontRoute = (router, { domains, rateLimit }) => {
  router.post(
    '/storefront/domains/:id/refresh',
    requirePermission('storefront:domain'),
    rateLimit('storefront.domains.refresh', {
      limit: 30,
      windowSeconds: 3600,
      failClosed: true,
      keyBy: (req) => dealerPrincipal(req).dealerId,
    }),
    validate({ params: IdParam }),
    handle(async (req, res) => {
      res.json(await domains.refresh(dealerPrincipal(req), validated<IdParam>(req, 'params').id));
    }),
  );
};
