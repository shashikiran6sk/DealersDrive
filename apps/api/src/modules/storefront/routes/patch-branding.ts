import { StorefrontBrandingInput } from '@dealers-drive/contracts';

import { dealerPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';
import { handle } from './handle.js';
import type { StorefrontRoute } from './route.js';

export const patchBranding: StorefrontRoute = (router, { service }) => {
  router.patch(
    '/storefront',
    requirePermission('storefront:manage'),
    validate({ body: StorefrontBrandingInput }),
    handle(async (req, res) => {
      res.json(
        await service.branding(
          dealerPrincipal(req),
          validated<StorefrontBrandingInput>(req, 'body'),
        ),
      );
    }),
  );
};
