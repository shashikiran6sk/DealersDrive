import { SitemapQuery } from '@dealers-drive/contracts';

import { validate } from '../../../middleware/validate.js';

import type { SearchRoute } from './route.js';

export const getSitemap: SearchRoute = (router, { service, publicReads }) => {
  router.get('/sitemap', publicReads, validate({ query: SitemapQuery }), (_req, res, next) => {
    void (async () => {
      try {
        res.set('Cache-Control', 'public, max-age=300');
        res.json(await service.sitemap());
      } catch (error) {
        next(error);
      }
    })();
  });
};
