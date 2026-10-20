import { customerPrincipal } from '../../../middleware/auth.js';
import { presentedCustomerCredential } from '../customer-session.js';
import type { CustomerAuthRoute } from './route.js';

export const getCustomerAccount: CustomerAuthRoute = (router, { customers }) => {
  router.get('/account', (req, res, next) => {
    void customers
      .accountStatus(customerPrincipal(req), presentedCustomerCredential(req))
      .then((result) => res.set('Cache-Control', 'no-store').json(result))
      .catch(next);
  });
};
