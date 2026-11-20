import {
  IdParam,
  VehicleSuggestQuery,
  type IdParam as IdParamType,
  type VehicleSuggestQuery as VehicleSuggestQueryType,
} from '@dealers-drive/contracts';
import { requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';
import { handle, type ModerationRoute } from './route.js';

export const getListingVehicleSuggestions: ModerationRoute = (router, service) => {
  router.get(
    '/listings/:id/vehicle/suggestions',
    requirePermission('admin:listing:moderate'),
    validate({ params: IdParam, query: VehicleSuggestQuery }),
    handle((req) =>
      service.vehicleSuggestions(
        validated<IdParamType>(req, 'params').id,
        validated<VehicleSuggestQueryType>(req, 'query'),
      ),
    ),
  );
};
