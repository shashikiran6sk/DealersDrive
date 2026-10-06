import { IdParam, SupportMessageInput } from '@dealers-drive/contracts';

import { customerPrincipal } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';
import { SUPPORT_RATE_LIMITED } from '../support.messages.js';

import { byCustomer } from './by-customer.js';
import { handle } from './handle.js';
import type { SupportRoute } from './route.js';

export const postTicketMessage: SupportRoute = (router, { service, rateLimit }) => {
  router.post(
    '/tickets/:id/messages',
    rateLimit('support.messages.customer', {
      limit: 30,
      windowSeconds: 3600,
      keyBy: byCustomer,
      code: 'SUPPORT_RATE_LIMITED',
      message: SUPPORT_RATE_LIMITED,
    }),
    validate({ params: IdParam, body: SupportMessageInput }),
    handle(
      (req) =>
        service.reply(
          customerPrincipal(req),
          validated<IdParam>(req, 'params').id,
          validated<SupportMessageInput>(req, 'body'),
        ),
      201,
    ),
  );
};
