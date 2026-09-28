import { PhoneSignInInput, type PhoneSignInResponse } from '@dealers-drive/contracts';

import { validate, validated } from '../../../middleware/validate.js';
import { setSessionCookie } from '../session.cookie.js';

import type { PublicAuthRoute } from './route.js';
import { byClaimedPhone, byIp, signInLimit } from './phone-sign-in-limit.js';

export const postSignInPhoneDealer: PublicAuthRoute = (router, { phoneSignIn, rateLimit }) => {
  router.post(
    '/sign-in/phone/dealer',
    rateLimit('auth.sign-in.phone.ip', signInLimit(20, 600, byIp)),
    rateLimit('auth.sign-in.phone.number', signInLimit(10, 600, byClaimedPhone)),
    validate({ body: PhoneSignInInput }),
    (req, res, next) => {
      void (async () => {
        try {
          const body = validated<PhoneSignInInput>(req, 'body');
          const result = await phoneSignIn.signInDealer(body, {
            ip: req.ip,
            userAgent: req.get('user-agent'),
          });

          setSessionCookie(res, result.token, result.expiresAt);
          res.set('Cache-Control', 'no-store');
          const response: PhoneSignInResponse = { next: result.next, returnTo: result.returnTo };
          res.json(response);
        } catch (error) {
          next(error);
        }
      })();
    },
  );
};
