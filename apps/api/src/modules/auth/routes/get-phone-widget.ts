import type { SessionAuthRoute } from './route.js';
import { phoneOtpLimit } from './phone-otp-limit.js';

/**
 * B8a — the widget configuration.
 *
 * Rate-limited even though it is a read. Each call is a licence to send SMS
 * from a browser, so the limit is on *starting* verifications rather than on
 * reading a config: thirty an hour is far more than a person signing up
 * needs and far less than a script would want.
 */
export const getPhoneWidget: SessionAuthRoute = (router, { phone, rateLimit }) => {
  router.get(
    '/phone/widget',
    rateLimit('auth.phone.widget', phoneOtpLimit(30, 3600)),
    (_req, res) => {
      res.set('Cache-Control', 'no-store');
      res.json(phone.widget());
    },
  );
};
