import type { PublicAuthRoute } from './route.js';
import { byIp, signInLimit } from './phone-sign-in-limit.js';

export const getSignInPhoneWidget: PublicAuthRoute = (router, { phoneSignIn, rateLimit }) => {
  router.get(
    '/sign-in/phone/widget',
    rateLimit('auth.sign-in.phone.widget', signInLimit(30, 3600, byIp)),
    (_req, res) => {
      res.set('Cache-Control', 'no-store');
      res.json(phoneSignIn.widget());
    },
  );
};
