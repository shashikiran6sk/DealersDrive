import { clearSessionCookie, readSessionToken } from '../session.cookie.js';

import type { PublicAuthRoute } from './route.js';

/**
 * Revokes whatever session the caller presents and clears the cookie. No
 * guard: signing out must work even when the session is already dead, and it
 * can only ever revoke the token in the caller's own cookie.
 */
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
