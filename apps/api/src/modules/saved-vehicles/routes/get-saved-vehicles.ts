import { SavedVehiclesQuery } from '@dealers-drive/contracts';

import { customerPrincipal } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle } from './handle.js';
import type { SavedVehiclesRoute } from './route.js';

export const getSavedVehicles: SavedVehiclesRoute = (router, { service }) => {
  router.get(
    '/',
    validate({ query: SavedVehiclesQuery }),
    handle((req) =>
      service.list(customerPrincipal(req), validated<SavedVehiclesQuery>(req, 'query')),
    ),
  );
};
