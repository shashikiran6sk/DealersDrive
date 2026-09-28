import {
  VehicleSlugParam,
  type VehicleSlugParam as VehicleSlugParamType,
} from '@dealers-drive/contracts';

import { customerPrincipal } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle } from './handle.js';
import type { SavedVehiclesRoute } from './route.js';
import { writeLimit } from './write-limit.js';

export const deleteSavedVehicle: SavedVehiclesRoute = (router, { service, rateLimit }) => {
  router.delete(
    '/:slug',
    writeLimit(rateLimit),
    validate({ params: VehicleSlugParam }),
    handle((req) =>
      service.unsave(customerPrincipal(req), validated<VehicleSlugParamType>(req, 'params').slug),
    ),
  );
};
