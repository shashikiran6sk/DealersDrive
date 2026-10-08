import { handle } from './handle.js';
import type { StorefrontRoute } from './route.js';

export const getSite: StorefrontRoute = (router, { service }) => {
  router.get(
    '/storefront/site',
    handle(async (req, res) => {
      res.json(await service.site(service.hostname(req)));
    }),
  );
};
