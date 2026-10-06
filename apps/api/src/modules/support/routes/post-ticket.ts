import { CreateSupportTicketInput } from '@dealers-drive/contracts';

import { customerPrincipal } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';
import { SUPPORT_RATE_LIMITED } from '../support.messages.js';

import { byCustomer } from './by-customer.js';
import { handle } from './handle.js';
import type { SupportRoute } from './route.js';

export const postTicket: SupportRoute = (router, { service, rateLimit }) => {
  router.post(
    '/tickets',
    rateLimit('support.tickets.create.customer', {
      limit: 5,
      windowSeconds: 3600,
      keyBy: byCustomer,
      code: 'SUPPORT_RATE_LIMITED',
      message: SUPPORT_RATE_LIMITED,
    }),
    rateLimit('support.tickets.create.ip', {
      limit: 20,
      windowSeconds: 3600,
      code: 'SUPPORT_RATE_LIMITED',
      message: SUPPORT_RATE_LIMITED,
    }),
    validate({ body: CreateSupportTicketInput }),
    handle(
      (req) =>
        service.create(customerPrincipal(req), validated<CreateSupportTicketInput>(req, 'body')),
      201,
    ),
  );
};
