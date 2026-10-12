import { IdParam } from '@dealers-drive/contracts';

import { customerPrincipal } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';
import { SUPPORT_RATE_LIMITED } from '../support.messages.js';

import { byCustomer } from './by-customer.js';
import { handle } from './handle.js';
import type { SupportRoute } from './route.js';

export const postTicketReopen: SupportRoute = (router, { service, rateLimit }) => {
  router.post(
    '/tickets/:id/reopen',
    rateLimit('support.reopen.customer', {
      limit: 10,
      windowSeconds: 3600,
      keyBy: byCustomer,
      code: 'SUPPORT_RATE_LIMITED',
      message: SUPPORT_RATE_LIMITED,
    }),
    validate({ params: IdParam }),
    handle((req) => service.reopen(customerPrincipal(req), validated<IdParam>(req, 'params').id)),
  );
};
