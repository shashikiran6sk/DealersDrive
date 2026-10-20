import { customerPrincipal } from '../../../middleware/auth.js';

import { handle } from './handle.js';
import type { SavedVehiclesRoute } from './route.js';

export const getSavedSlugs: SavedVehiclesRoute = (router, { service }) => {
  router.get(
    '/slugs',
    handle((req) => service.slugs(customerPrincipal(req))),
  );
};
