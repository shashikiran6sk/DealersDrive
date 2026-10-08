import { StorefrontMediaCommitInput } from '@dealers-drive/contracts';

import { dealerPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';
import { handle } from './handle.js';
import type { StorefrontRoute } from './route.js';

export const postMediaCommit: StorefrontRoute = (router, { media, rateLimit }) => {
  router.post(
    '/storefront/media/commit',
    requirePermission('storefront:manage'),
    rateLimit('storefront.media.commit', {
      limit: 30,
      windowSeconds: 3600,
      failClosed: true,
      keyBy: (req) => dealerPrincipal(req).dealerId,
    }),
    validate({ body: StorefrontMediaCommitInput }),
    handle(async (req, res) => {
      res.json(
        await media.commit(
          dealerPrincipal(req),
          validated<StorefrontMediaCommitInput>(req, 'body').mediaId,
        ),
      );
    }),
  );
};
