import { StorefrontMediaPresignInput } from '@dealers-drive/contracts';

import { dealerPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';
import { handle } from './handle.js';
import type { StorefrontRoute } from './route.js';

export const postMediaPresign: StorefrontRoute = (router, { media, rateLimit }) => {
  router.post(
    '/storefront/media/presign',
    requirePermission('storefront:manage'),
    rateLimit('storefront.media', {
      limit: 30,
      windowSeconds: 3600,
      failClosed: true,
      keyBy: (req) => dealerPrincipal(req).dealerId,
    }),
    validate({ body: StorefrontMediaPresignInput }),
    handle(async (req, res) => {
      res.json(
        await media.presign(
          dealerPrincipal(req),
          validated<StorefrontMediaPresignInput>(req, 'body'),
        ),
      );
    }),
  );
};
