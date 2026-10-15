import { customerPrincipal } from '../../../middleware/auth.js';
import { readCustomerBearer } from '../native-customer-token.js';
import { readSessionToken } from '../session.cookie.js';
import type { CustomerAuthRoute } from './route.js';

export const getCustomerAccount: CustomerAuthRoute = (router, { customers }) => {
  router.get('/account', (req, res, next) => {
    void customers
      .accountStatus(customerPrincipal(req), readCustomerBearer(req) ?? readSessionToken(req))
      .then((result) => res.set('Cache-Control', 'no-store').json(result))
      .catch(next);
  });
};
