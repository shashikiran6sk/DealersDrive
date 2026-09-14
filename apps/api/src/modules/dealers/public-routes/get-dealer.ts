import type { SlugParam as SlugParamType } from '@dealers-drive/contracts';
import { SlugParam } from '@dealers-drive/contracts';

import { validate, validated } from '../../../middleware/validate.js';

import type { PublicDealersRoute } from './route.js';

export const getDealer: PublicDealersRoute = (router, { service, publicReads }) => {
  router.get('/dealers/:slug', publicReads, validate({ params: SlugParam }), (req, res, next) => {
    void (async () => {
      try {
        const params = validated<SlugParamType>(req, 'params');
        res.set('Cache-Control', 'public, max-age=300');
        res.json(await service.profile(params.slug));
      } catch (error) {
        next(error);
      }
    })();
  });
};
