import { CustomerSignInInput, type CustomerSignInResponse } from '@dealers-drive/contracts';

import { validate, validated } from '../../../middleware/validate.js';
import { setSessionCookie } from '../session.cookie.js';

import type { PublicAuthRoute } from './route.js';
import { byClaimedPhone, byIp, signInLimit } from './phone-sign-in-limit.js';

export const postSignInPhoneCustomer: PublicAuthRoute = (router, { customers, rateLimit }) => {
  router.post(
    '/sign-in/phone/customer',
    rateLimit('auth.sign-in.customer.ip', signInLimit(20, 600, byIp)),
    rateLimit('auth.sign-in.customer.number', signInLimit(10, 600, byClaimedPhone)),
    validate({ body: CustomerSignInInput }),
    (req, res, next) => {
      void (async () => {
        try {
          const body = validated<CustomerSignInInput>(req, 'body');
          const { session, ...result } = await customers.signIn(body, {
            ip: req.ip,
            userAgent: req.get('user-agent'),
          });

          if (session) setSessionCookie(res, session.token, session.expiresAt);
          res.set('Cache-Control', 'no-store');
          const response: CustomerSignInResponse = result;
          res.json(response);
        } catch (error) {
          next(error);
        }
      })();
    },
  );
};
