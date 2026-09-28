import { clearSessionCookie, readSessionToken } from '../session.cookie.js';

import type { PublicAuthRoute } from './route.js';

export const postCustomerLogout: PublicAuthRoute = (router, { customers }) => {
  router.post('/customer/logout', (req, res, next) => {
    void (async () => {
      try {
        await customers.logout(readSessionToken(req));
        clearSessionCookie(res);
        res.status(204).end();
      } catch (error) {
        next(error);
      }
    })();
  });
};
