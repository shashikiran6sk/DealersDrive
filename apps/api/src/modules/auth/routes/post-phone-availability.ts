import { PhoneAvailabilityInput } from '@dealers-drive/contracts';

import { signedInPrincipal } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import type { SessionAuthRoute } from './route.js';
import { phoneOtpLimit } from './phone-otp-limit.js';

export const postPhoneAvailability: SessionAuthRoute = (router, { phone, rateLimit }) => {
  router.post(
    '/phone/availability',
    rateLimit('auth.phone.availability', phoneOtpLimit(30, 3600)),
    validate({ body: PhoneAvailabilityInput }),
    (req, res, next) => {
      void (async () => {
        try {
          const principal = signedInPrincipal(req);
          const body = validated<PhoneAvailabilityInput>(req, 'body');
          await phone.assertAvailable(principal.userId, body);
          res.set('Cache-Control', 'no-store');
          res.status(204).end();
        } catch (error) {
          next(error);
        }
      })();
    },
  );
};
