import { SalesPhoneVerifyInput } from '@dealers-drive/contracts';

import { adminPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';
import { salesPhoneLimit } from './phone-limit.js';

import { handle, type SalesRoute } from './route.js';

export const postPhoneVerify: SalesRoute = (router, { service, rateLimit }) => {
  router.post(
    '/dealers/phone/verify',
    requirePermission('sales:dealer:create'),
    rateLimit('sales.phone.verify', salesPhoneLimit(10, 600)),
    validate({ body: SalesPhoneVerifyInput }),
    handle((req) =>
      service.verifyPhone(adminPrincipal(req), validated<SalesPhoneVerifyInput>(req, 'body'), {
        ip: req.ip,
      }),
    ),
  );
};
