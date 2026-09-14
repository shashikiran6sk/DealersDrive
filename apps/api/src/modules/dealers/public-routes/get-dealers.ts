import type { DealerDirectoryQuery as DealerDirectoryQueryType } from '@dealers-drive/contracts';
import { DealerDirectoryQuery } from '@dealers-drive/contracts';

import { validate, validated } from '../../../middleware/validate.js';

import type { PublicDealersRoute } from './route.js';

export const getDealers: PublicDealersRoute = (router, { service, publicReads }) => {
  router.get(
    '/dealers',
    publicReads,
    validate({ query: DealerDirectoryQuery }),
    (req, res, next) => {
      void (async () => {
        try {
          const query = validated<DealerDirectoryQueryType>(req, 'query');
          res.set('Cache-Control', 'public, max-age=300');
          res.json(await service.directory(query));
        } catch (error) {
          next(error);
        }
      })();
    },
  );
};
