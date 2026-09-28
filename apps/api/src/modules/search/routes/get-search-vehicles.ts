import {
  CarSuggestQuery,
  type CarSuggestQuery as CarSuggestQueryType,
} from '@dealers-drive/contracts';

import { validate, validated } from '../../../middleware/validate.js';

import type { SearchRoute } from './route.js';

export const getSearchVehicles: SearchRoute = (router, { service, publicReads }) => {
  router.get(
    '/search/vehicles',
    publicReads,
    validate({ query: CarSuggestQuery }),
    (req, res, next) => {
      void (async () => {
        try {
          const query = validated<CarSuggestQueryType>(req, 'query');
          res.set('Cache-Control', 'public, max-age=60');
          res.json(await service.suggestCars(query));
        } catch (error) {
          next(error);
        }
      })();
    },
  );
};
