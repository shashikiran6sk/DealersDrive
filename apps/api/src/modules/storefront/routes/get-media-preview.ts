import { StorefrontMediaParam } from '@dealers-drive/contracts';

import { dealerPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';
import { handle } from './handle.js';
import type { StorefrontRoute } from './route.js';

export const getMediaPreview: StorefrontRoute = (router, { media }) => {
  router.get(
    '/storefront/media/:mediaId/:width.webp',
    requirePermission('storefront:read'),
    validate({ params: StorefrontMediaParam }),
    handle(async (req, res) => {
      const params = validated<StorefrontMediaParam>(req, 'params');
      const image = await media.image(dealerPrincipal(req), params.mediaId, params.width);
      res.set('X-Robots-Tag', 'noindex, nofollow').type(image.mimeType).send(image.body);
    }),
  );
};
