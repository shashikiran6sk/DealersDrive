import { CustomerSignUpInput, type CustomerSession } from '@dealers-drive/contracts';

import { validate, validated } from '../../../middleware/validate.js';
import { setSessionCookie } from '../session.cookie.js';

import type { PublicAuthRoute } from './route.js';
import { byIp, signInLimit } from './phone-sign-in-limit.js';

export const postSignUpCustomer: PublicAuthRoute = (router, { customers, rateLimit }) => {
  router.post(
    '/sign-up/customer',
    rateLimit('auth.sign-up.customer.ip', signInLimit(10, 3600, byIp)),
    validate({ body: CustomerSignUpInput }),
    (req, res, next) => {
      void (async () => {
        try {
          const body = validated<CustomerSignUpInput>(req, 'body');
          const { customer, session } = await customers.signUp(body, {
            ip: req.ip,
            userAgent: req.get('user-agent'),
          });

          setSessionCookie(res, session.token, session.expiresAt);
          res.set('Cache-Control', 'no-store');
          const response: CustomerSession = { customer };
          res.status(201).json(response);
        } catch (error) {
          next(error);
        }
      })();
    },
  );
};
