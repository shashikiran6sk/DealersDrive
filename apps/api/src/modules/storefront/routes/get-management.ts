import { dealerPrincipal, requirePermission } from '../../../middleware/auth.js';
import { handle } from './handle.js';
import type { StorefrontRoute } from './route.js';

export const getManagement: StorefrontRoute = (router, { service }) => {
  router.get(
    '/storefront',
    requirePermission('storefront:read'),
    handle(async (req, res) => {
      res.json(await service.management(dealerPrincipal(req)));
    }),
  );
};
