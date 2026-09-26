import {
  VehicleSuggestQuery,
  type VehicleSuggestQuery as VehicleSuggestQueryType,
} from '@dealers-drive/contracts';

import { requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type VehiclesRoute } from './route.js';

export const getVehicleSuggestions: VehiclesRoute = (router, service) => {
  router.get(
    '/vehicles/suggestions',
    requirePermission('vehicle:read'),
    validate({ query: VehicleSuggestQuery }),
    handle((req) => service.suggestions(validated<VehicleSuggestQueryType>(req, 'query'))),
  );
};
