import { signedInPrincipal } from '../../../middleware/auth.js';

import type { SessionAuthRoute } from './route.js';

export const getMe: SessionAuthRoute = (router, { service }) => {
  router.get('/me', (req, res, next) => {
    void (async () => {
      try {
        res.set('Cache-Control', 'no-store');
        res.json(await service.me(signedInPrincipal(req)));
      } catch (error) {
        next(error);
      }
    })();
  });
};
