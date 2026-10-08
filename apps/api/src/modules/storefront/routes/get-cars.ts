import { StorefrontInventoryQuery } from '@dealers-drive/contracts';

import { validate, validated } from '../../../middleware/validate.js';
import { handle } from './handle.js';
import type { StorefrontRoute } from './route.js';

export const getCars: StorefrontRoute = (router, { service }) => {
  router.get(
    '/storefront/cars',
    validate({ query: StorefrontInventoryQuery }),
    handle(async (req, res) => {
      res.json(
        await service.inventory(
          service.hostname(req),
          validated<StorefrontInventoryQuery>(req, 'query'),
        ),
      );
    }),
  );
};
