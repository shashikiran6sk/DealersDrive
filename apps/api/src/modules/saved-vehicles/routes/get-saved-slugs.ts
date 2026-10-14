import { SavedSlugsQuery } from '@dealers-drive/contracts';
import { validate, validated } from '../../../middleware/validate.js';
import { customerPrincipal } from '../../../middleware/auth.js';

import { handle } from './handle.js';
import type { SavedVehiclesRoute } from './route.js';

export const getSavedSlugs: SavedVehiclesRoute = (router, { service }) => {
  router.get(
    '/slugs',
    validate({ query: SavedSlugsQuery }),
    handle((req) =>
      service.slugs(customerPrincipal(req), validated<SavedSlugsQuery>(req, 'query')),
    ),
  );
};
