import {
  AdminUpdateVehicleInput,
  IdParam,
  type IdParam as IdParamType,
} from '@dealers-drive/contracts';
import { adminPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';
import { handle, type ModerationRoute } from './route.js';

export const patchListingVehicle: ModerationRoute = (router, service) => {
  router.patch(
    '/listings/:id/vehicle',
    requirePermission('admin:listing:moderate'),
    validate({ body: AdminUpdateVehicleInput, params: IdParam }),
    handle((req) =>
      service.updateVehicle(
        adminPrincipal(req),
        validated<IdParamType>(req, 'params').id,
        validated<AdminUpdateVehicleInput>(req, 'body'),
      ),
    ),
  );
};
