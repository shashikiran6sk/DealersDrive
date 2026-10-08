import { dealerPrincipal, requirePermission } from '../../../middleware/auth.js';
import { handle } from './handle.js';
import type { StorefrontRoute } from './route.js';

export const getPreview: StorefrontRoute = (router, { service }) => {
  router.get(
    '/storefront/preview',
    requirePermission('storefront:read'),
    handle(async (req, res) => {
      res.set('X-Robots-Tag', 'noindex, nofollow');
      res.json(await service.preview(dealerPrincipal(req)));
    }),
  );
};
