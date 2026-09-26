import {
  VehicleSlugParam,
  type VehicleSlugParam as VehicleSlugParamType,
} from '@dealers-drive/contracts';

import { validate, validated } from '../../../middleware/validate.js';

import type { SearchRoute } from './route.js';

export const getVehicle: SearchRoute = (router, { service, publicReads }) => {
  router.get(
    '/vehicles/:slug',
    publicReads,
    validate({ params: VehicleSlugParam }),
    (req, res, next) => {
      void (async () => {
        try {
          const params = validated<VehicleSlugParamType>(req, 'params');
          const vehicle = await service.vehicle(params.slug);
          res.set('Cache-Control', 'public, max-age=60');
          res.json(vehicle);
        } catch (error) {
          next(error);
        }
      })();
    },
  );
};
