import type { SessionAuthRoute } from './route.js';
import { phoneOtpLimit } from './phone-otp-limit.js';

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
