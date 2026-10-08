import { VehicleSlugParam } from '@dealers-drive/contracts';

import { validate, validated } from '../../../middleware/validate.js';
import { handle } from './handle.js';
import type { StorefrontRoute } from './route.js';

export const getCar: StorefrontRoute = (router, { service }) => {
  router.get(
    '/storefront/cars/:slug',
    validate({ params: VehicleSlugParam }),
    handle(async (req, res) => {
      res.json(
        await service.vehicle(
          service.hostname(req),
          validated<VehicleSlugParam>(req, 'params').slug,
        ),
      );
    }),
  );
};
