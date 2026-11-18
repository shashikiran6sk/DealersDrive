import {
  IdParam,
  VehicleSuggestQuery,
  type VehicleSuggestQuery as VehicleSuggestQueryType,
} from '@dealers-drive/contracts';

import { adminPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type SalesRoute } from './route.js';

export const getDealerVehicleSuggestions: SalesRoute = (router, { service }) => {
  router.get(
    '/dealers/:id/vehicles/suggestions',
    requirePermission('sales:listing:read'),
    validate({ params: IdParam, query: VehicleSuggestQuery }),
    handle((req) =>
      service.vehicleSuggestions(
        adminPrincipal(req),
        validated<IdParam>(req, 'params').id,
        validated<VehicleSuggestQueryType>(req, 'query'),
      ),
    ),
  );
};
