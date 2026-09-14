import { clearSessionCookie, readSessionToken } from '../session.cookie.js';

import type { PublicAuthRoute } from './route.js';

export const postAdminLogout: PublicAuthRoute = (router, { service }) => {
  router.post('/admin/logout', (req, res, next) => {
    void (async () => {
      try {
        await service.logout(readSessionToken(req));
        clearSessionCookie(res);
        res.status(204).end();
      } catch (error) {
        next(error);
      }
    })();
  });
};
