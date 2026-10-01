import { CustomerSupportTicketQuery } from '@dealers-drive/contracts';

import { customerPrincipal } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle } from './handle.js';
import type { SupportRoute } from './route.js';

export const getMyTickets: SupportRoute = (router, { service }) => {
  router.get(
    '/tickets',
    validate({ query: CustomerSupportTicketQuery }),
    handle((req) =>
      service.mine(customerPrincipal(req), validated<CustomerSupportTicketQuery>(req, 'query')),
    ),
  );
};
