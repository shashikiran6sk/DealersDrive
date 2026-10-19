import { CustomerReactivationInput } from '@dealers-drive/contracts';
import { validate, validated } from '../../../middleware/validate.js';
import { requireLegalOrigin } from '../../legal/legal.facade.js';
import { setSessionCookie } from '../session.cookie.js';
import { byIp, signInLimit } from './phone-sign-in-limit.js';
import type { PublicAuthRoute } from './route.js';

export const postCustomerReactivate: PublicAuthRoute = (router, { customers, rateLimit }) => {
  router.post(
    '/customer/reactivate',
    requireLegalOrigin,
    rateLimit('auth.customer.reactivate.ip', signInLimit(10, 600, byIp)),
    validate({ body: CustomerReactivationInput }),
    (req, res, next) => {
      void customers
        .reactivate(validated<CustomerReactivationInput>(req, 'body'), {
          ip: req.ip,
          userAgent: req.get('user-agent'),
        })
        .then((result) => {
          setSessionCookie(res, result.session.token, result.session.expiresAt);
          res.set('Cache-Control', 'no-store').json({ customer: result.customer });
        })
        .catch(next);
    },
  );
};
