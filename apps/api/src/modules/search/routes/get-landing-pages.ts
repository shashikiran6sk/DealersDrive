import { LandingPagesQuery } from '@dealers-drive/contracts';

import { validate } from '../../../middleware/validate.js';

import type { SearchRoute } from './route.js';

export const getLandingPages: SearchRoute = (router, { service, publicReads }) => {
  router.get(
    '/landing-pages',
    publicReads,
    validate({ query: LandingPagesQuery }),
    (_req, res, next) => {
      void (async () => {
        try {
          res.set('Cache-Control', 'public, max-age=300');
          res.json(await service.landingPages());
        } catch (error) {
          next(error);
        }
      })();
    },
  );
};
