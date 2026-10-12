import { SalesEmailVerifyInput } from '@dealers-drive/contracts';

import { adminPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';
import { salesPhoneLimit } from './phone-limit.js';

import { handle, type SalesRoute } from './route.js';

export const postEmailVerify: SalesRoute = (router, { service, rateLimit }) => {
  router.post(
    '/dealers/email/verify',
    requirePermission('sales:dealer:create'),
    rateLimit('sales.email.verify', salesPhoneLimit(20, 600)),
    validate({ body: SalesEmailVerifyInput }),
    handle((req) =>
      service.verifyEmail(adminPrincipal(req), validated<SalesEmailVerifyInput>(req, 'body')),
    ),
  );
};
