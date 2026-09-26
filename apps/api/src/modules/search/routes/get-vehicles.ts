import {
  PublicVehicleQuery,
  type PublicVehicleQuery as PublicVehicleQueryType,
} from '@dealers-drive/contracts';

import { validate, validated } from '../../../middleware/validate.js';

import type { SearchRoute } from './route.js';

export const getVehicles: SearchRoute = (router, { service, publicReads }) => {
  router.get(
    '/vehicles',
    publicReads,
    validate({ query: PublicVehicleQuery }),
    (req, res, next) => {
      void (async () => {
        try {
          const query = validated<PublicVehicleQueryType>(req, 'query');
          res.set('Cache-Control', 'public, max-age=60');
          res.json(await service.vehicles(query));
        } catch (error) {
          next(error);
        }
      })();
    },
  );
};
