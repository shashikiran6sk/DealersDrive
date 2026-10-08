import { StorefrontSitemapQuery } from '@dealers-drive/contracts';

import { validate, validated } from '../../../middleware/validate.js';
import { handle } from './handle.js';
import type { StorefrontRoute } from './route.js';

export const getSitemap: StorefrontRoute = (router, { service }) => {
  router.get(
    '/storefront/sitemap',
    validate({ query: StorefrontSitemapQuery }),
    handle(async (req, res) => {
      res.json(
        await service.sitemap(
          service.hostname(req),
          validated<StorefrontSitemapQuery>(req, 'query').page,
        ),
      );
    }),
  );
};
