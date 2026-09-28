import {
  VehicleSlugParam,
  type VehicleSlugParam as VehicleSlugParamType,
} from '@dealers-drive/contracts';

import { customerPrincipal } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle } from './handle.js';
import type { SavedVehiclesRoute } from './route.js';
import { writeLimit } from './write-limit.js';

export const putSavedVehicle: SavedVehiclesRoute = (router, { service, rateLimit }) => {
  router.put(
    '/:slug',
    writeLimit(rateLimit),
    validate({ params: VehicleSlugParam }),
    handle((req) =>
      service.save(customerPrincipal(req), validated<VehicleSlugParamType>(req, 'params').slug),
    ),
  );
};
