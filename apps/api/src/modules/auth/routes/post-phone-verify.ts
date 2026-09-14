import { VerifyPhoneInput } from '@dealers-drive/contracts';

import { signedInPrincipal } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import type { SessionAuthRoute } from './route.js';
import { phoneOtpLimit } from './phone-otp-limit.js';

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
