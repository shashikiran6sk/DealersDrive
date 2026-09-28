import {
  VehicleSlugParam,
  type VehicleSlugParam as VehicleSlugParamType,
} from '@dealers-drive/contracts';

import { validate, validated } from '../../../middleware/validate.js';

import type { SearchRoute } from './route.js';

export const getVehicleSimilar: SearchRoute = (router, { service, publicReads }) => {
  router.get(
    '/vehicles/:slug/similar',
    publicReads,
    validate({ params: VehicleSlugParam }),
    (req, res, next) => {
      void (async () => {
        try {
          const params = validated<VehicleSlugParamType>(req, 'params');
          const similar = await service.similar(params.slug);
          res.set('Cache-Control', 'public, max-age=60');
          res.json(similar);
        } catch (error) {
          next(error);
        }
      })();
    },
  );
};
