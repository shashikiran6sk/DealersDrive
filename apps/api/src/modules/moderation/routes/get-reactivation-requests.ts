import {
  AdminReactivationQuery,
  type AdminReactivationQuery as AdminReactivationQueryType,
} from '@dealers-drive/contracts';

import { requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type ModerationRoute } from './route.js';

export const getReactivationRequests: ModerationRoute = (router, service) => {
  router.get(
    '/reactivation-requests',
    requirePermission('admin:listing:moderate'),
    validate({ query: AdminReactivationQuery }),
    handle((req) => service.reactivations(validated<AdminReactivationQueryType>(req, 'query'))),
  );
};
