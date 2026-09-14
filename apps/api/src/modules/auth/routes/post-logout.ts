import { clearSessionCookie, readSessionToken } from '../session.cookie.js';
import { signedInPrincipal } from '../../../middleware/auth.js';

import type { SessionAuthRoute } from './route.js';

export const postLogout: SessionAuthRoute = (router, { service }) => {
  router.post('/logout', (req, res, next) => {
    void (async () => {
      try {
        await service.logout(readSessionToken(req), signedInPrincipal(req).userId);
        clearSessionCookie(res);
        res.status(204).end();
      } catch (error) {
        next(error);
      }
    })();
  });
};
