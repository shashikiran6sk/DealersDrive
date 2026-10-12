import { SalesEmailCodeInput } from '@dealers-drive/contracts';

import { adminPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';
import { salesPhoneLimit } from './phone-limit.js';

import { handle, type SalesRoute } from './route.js';

export const postEmailCode: SalesRoute = (router, { service, rateLimit }) => {
  router.post(
    '/dealers/email/code',
    requirePermission('sales:dealer:create'),
    rateLimit('sales.email.code', salesPhoneLimit(10, 600)),
    validate({ body: SalesEmailCodeInput }),
    handle((req) =>
      service.sendEmailCode(adminPrincipal(req), validated<SalesEmailCodeInput>(req, 'body')),
    ),
  );
};
