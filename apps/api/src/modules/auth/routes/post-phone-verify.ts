import { VerifyPhoneInput } from '@dealers-drive/contracts';

import { signedInPrincipal } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';
import { setSessionCookie } from '../session.cookie.js';

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
          const verified = await phone.verify(principal.userId, body, {
            ...(req.ip ? { ip: req.ip } : {}),
            ...(req.get('user-agent') ? { userAgent: req.get('user-agent') } : {}),
          });
          if (verified.session) {
            setSessionCookie(res, verified.session.token, verified.session.expiresAt);
          }
          res.set('Cache-Control', 'no-store');
          res.json(verified.response);
        } catch (error) {
          next(error);
        }
      })();
    },
  );
};
