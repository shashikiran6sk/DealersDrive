import { CreateStorefrontInput } from '@dealers-drive/contracts';

import { dealerPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';
import { handle } from './handle.js';
import type { StorefrontRoute } from './route.js';

export const postManagement: StorefrontRoute = (router, { service, rateLimit }) => {
  router.post(
    '/storefront',
    requirePermission('storefront:manage'),
    rateLimit('storefront.create', {
      limit: 20,
      windowSeconds: 3600,
      failClosed: true,
      keyBy: (req) => dealerPrincipal(req).dealerId,
    }),
    validate({ body: CreateStorefrontInput }),
    handle(async (req, res) => {
      res
        .status(201)
        .json(
          await service.create(dealerPrincipal(req), validated<CreateStorefrontInput>(req, 'body')),
        );
    }),
  );
};
