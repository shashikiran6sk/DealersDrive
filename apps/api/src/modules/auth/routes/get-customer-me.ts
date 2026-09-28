import { customerPrincipal } from '../../../middleware/auth.js';

import type { CustomerAuthRoute } from './route.js';

export const getCustomerMe: CustomerAuthRoute = (router, { customers }) => {
  router.get('/me', (req, res, next) => {
    void (async () => {
      try {
        res.set('Cache-Control', 'no-store');
        res.json(await customers.me(customerPrincipal(req).userId));
      } catch (error) {
        next(error);
      }
    })();
  });
};
