import type { DealerSuggestQuery as DealerSuggestQueryType } from '@dealers-drive/contracts';
import { DealerSuggestQuery } from '@dealers-drive/contracts';

import { validate, validated } from '../../../middleware/validate.js';

import type { PublicDealersRoute } from './route.js';

export const getSearchDealers: PublicDealersRoute = (router, { service, publicReads }) => {
  router.get(
    '/search/dealers',
    publicReads,
    validate({ query: DealerSuggestQuery }),
    (req, res, next) => {
      void (async () => {
        try {
          const query = validated<DealerSuggestQueryType>(req, 'query');
          res.set('Cache-Control', 'public, max-age=60');
          res.json(await service.suggest(query));
        } catch (error) {
          next(error);
        }
      })();
    },
  );
};
