import { SetStorefrontEnabledInput } from '@dealers-drive/contracts';

import { dealerPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';
import { handle } from './handle.js';
import type { StorefrontRoute } from './route.js';

export const putEnabled: StorefrontRoute = (router, { service }) => {
  router.put(
    '/storefront/enabled',
    requirePermission('storefront:manage'),
    validate({ body: SetStorefrontEnabledInput }),
    handle(async (req, res) => {
      res.json(
        await service.setEnabled(
          dealerPrincipal(req),
          validated<SetStorefrontEnabledInput>(req, 'body').enabled,
        ),
      );
    }),
  );
};
