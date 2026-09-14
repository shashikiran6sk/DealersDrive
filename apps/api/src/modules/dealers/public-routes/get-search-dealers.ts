import type { DealerSuggestQuery as DealerSuggestQueryType } from '@dealers-drive/contracts';
import { DealerSuggestQuery } from '@dealers-drive/contracts';

import { validate, validated } from '../../../middleware/validate.js';

import type { PublicDealersRoute } from './route.js';

/*
 * A8b — the dealer typeahead (**R43**).
 *
 * Mounted at `/v1/search/dealers` rather than `/v1/dealers/suggest`, and the
 * namespace is the point: `/v1/search/vehicles` arrives at **F076** with the
 * same query grammar and the same response shape, and a buyer typing into
 * two boxes on two pages should be hitting one family of endpoints rather
 * than a dealer-shaped one and a vehicle-shaped one.
 *
 * It still lives in this module, for the reason the file docblock gives: it
 * calls `dealersPublic` and nothing else. The path is about the audience, not
 * about the folder.
 *
 * **`Cache-Control: public, max-age=60`**, a fifth of what the directory
 * gets. The rows are the same rows, but this is answered while somebody is
 * typing — every extra character is another request, so the cache is doing
 * more work per unit of staleness here than anywhere else in the product, and
 * a minute is short enough that a newly-approved dealership appears in the
 * dropdown at about the same time it appears in the grid.
 */
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
