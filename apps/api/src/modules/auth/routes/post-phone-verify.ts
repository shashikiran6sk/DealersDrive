import { VerifyPhoneInput } from '@dealers-drive/contracts';

import { signedInPrincipal } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import type { SessionAuthRoute } from './route.js';
import { phoneOtpLimit } from './phone-otp-limit.js';

/**
 * B8c — the widget's access token, checked with MSG91 and recorded.
 *
 * The tighter of the two limits, because this is the one that writes. Ten
 * presentations in ten minutes covers a dealer who mistypes a code twice and
 * asks for a fresh one; it does not cover walking a stolen token through a
 * list of numbers.
 */
export const postPhoneVerify: SessionAuthRoute = (router, { phone, rateLimit }) => {
  router.post(
    '/phone/verify',
    rateLimit('auth.phone.verify', phoneOtpLimit(10, 600)),
    validate({ body: VerifyPhoneInput }),
    (req, res, next) => {
      void (async () => {
        try {
          const principal = signedInPrincipal(req);
          const body = validated<VerifyPhoneInput>(req, 'body');
          res.set('Cache-Control', 'no-store');
          res.json(await phone.verify(principal.userId, body, { ip: req.ip }));
        } catch (error) {
          next(error);
        }
      })();
    },
  );
};
