import { IdParam } from '@dealers-drive/contracts';

import { customerPrincipal } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle } from './handle.js';
import type { SupportRoute } from './route.js';

export const getMyTicket: SupportRoute = (router, { service }) => {
  router.get(
    '/tickets/:id',
    validate({ params: IdParam }),
    handle((req) => service.detail(customerPrincipal(req), validated<IdParam>(req, 'params').id)),
  );
};
