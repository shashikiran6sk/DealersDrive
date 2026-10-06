import {
  DealerInventoryQuery,
  type DealerInventoryQuery as DealerInventoryQueryType,
} from '@dealers-drive/contracts';

import { dealerPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type VehiclesRoute } from './route.js';

export const getVehicles: VehiclesRoute = (router, service) => {
  router.get(
    '/vehicles',
    requirePermission('vehicle:read'),
    validate({ query: DealerInventoryQuery }),
    handle((req) =>
      service.inventory(
        dealerPrincipal(req).dealerId,
        validated<DealerInventoryQueryType>(req, 'query'),
        dealerPrincipal(req).permissions,
      ),
    ),
  );
};
