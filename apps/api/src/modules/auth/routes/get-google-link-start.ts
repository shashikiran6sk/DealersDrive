import { signedInPrincipal } from '../../../middleware/auth.js';
import { setOAuthCookie } from '../session.cookie.js';

import type { SessionAuthRoute } from './route.js';

export const getGoogleLinkStart: SessionAuthRoute = (router, { service }) => {
  router.get('/google/link/start', (req, res, next) => {
    try {
      const principal = signedInPrincipal(req);
      const returnTo = typeof req.query.returnTo === 'string' ? req.query.returnTo : undefined;
      const { authorizationUrl, cookie, maxAgeSeconds } = service.startGoogle(
        returnTo,
        'LINK',
        principal.userId,
      );

      setOAuthCookie(res, cookie, maxAgeSeconds);
      res.redirect(302, authorizationUrl);
    } catch (error) {
      next(error);
    }
  });
};
