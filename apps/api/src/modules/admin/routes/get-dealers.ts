import {
  AdminDealerQuery,
  type AdminDealerQuery as AdminDealerQueryType,
} from '@dealers-drive/contracts';

import { validate, validated } from '../../../middleware/validate.js';

import { handle, type AdminRoute } from './route.js';

export const getDealers: AdminRoute = (router, service) => {
  router.get(
    '/dealers',
    validate({ query: AdminDealerQuery }),
    handle((req) => service.dealers(validated<AdminDealerQueryType>(req, 'query'))),
  );
};
