import {
  AdminListingQuery,
  type AdminListingQuery as AdminListingQueryType,
} from '@dealers-drive/contracts';

import { requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type ModerationRoute } from './route.js';

export const getListings: ModerationRoute = (router, service) => {
  router.get(
    '/listings',
    requirePermission('admin:listing:moderate'),
    validate({ query: AdminListingQuery }),
    handle((req) => service.listings(validated<AdminListingQueryType>(req, 'query'))),
  );
};
