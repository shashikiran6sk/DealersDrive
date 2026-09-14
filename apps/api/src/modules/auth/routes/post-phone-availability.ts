import { PhoneAvailabilityInput } from '@dealers-drive/contracts';

import { signedInPrincipal } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import type { SessionAuthRoute } from './route.js';
import { phoneOtpLimit } from './phone-otp-limit.js';

/**
 * B8b — may this account claim this number?
 *
 * The first of the two calls step 1 makes, and the cheap one. It is asked
 * before the browser sends anything, because the send is the browser's and
 * the API cannot refuse one that is already on its way — so a number
 * somebody else holds has to be caught here or not at all, and "not at all"
 * means paying for a message to tell a dealer they cannot have their own
 * number.
 *
 * **Rate-limited because it is a lookup about other people's numbers.** A
 * yes/no about whether the platform knows a number is a yes/no somebody
 * could walk a list through, so it is behind the session like everything
 * else here and capped at the same order as the widget itself. It never says
 * who holds one.
 */
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
