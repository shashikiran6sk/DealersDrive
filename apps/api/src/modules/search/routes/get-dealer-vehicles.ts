import {
  PublicVehicleQuery,
  SlugParam,
  type PublicVehicleQuery as PublicVehicleQueryType,
  type SlugParam as SlugParamType,
} from '@dealers-drive/contracts';

import { validate, validated } from '../../../middleware/validate.js';

import type { SearchRoute } from './route.js';

export const getDealerVehicles: SearchRoute = (router, { service, publicReads }) => {
  router.get(
    '/dealers/:slug/vehicles',
    publicReads,
    validate({ params: SlugParam, query: PublicVehicleQuery }),
    (req, res, next) => {
      void (async () => {
        try {
          const params = validated<SlugParamType>(req, 'params');
          const query = validated<PublicVehicleQueryType>(req, 'query');
          const vehicles = await service.dealerVehicles(params.slug, query);
          res.set('Cache-Control', 'public, max-age=60');
          res.json(vehicles);
        } catch (error) {
          next(error);
        }
      })();
    },
  );
};
