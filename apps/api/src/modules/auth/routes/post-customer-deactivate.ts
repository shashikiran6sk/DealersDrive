import { CustomerDeactivationInput } from '@dealers-drive/contracts';
import { customerPrincipal } from '../../../middleware/auth.js';
import { validate } from '../../../middleware/validate.js';
import { requireLegalOrigin } from '../../legal/legal.facade.js';
import { readCustomerBearer } from '../native-customer-token.js';
import { clearSessionCookie, readSessionToken } from '../session.cookie.js';
import type { CustomerAuthRoute } from './route.js';

export const postCustomerDeactivate: CustomerAuthRoute = (router, { customers }) => {
  router.post(
    '/account/deactivate',
    requireLegalOrigin,
    validate({ body: CustomerDeactivationInput }),
    (req, res, next) => {
      void customers
        .deactivate(customerPrincipal(req), readCustomerBearer(req) ?? readSessionToken(req))
        .then((result) => {
          if (!req.get('authorization')) clearSessionCookie(res);
          res.set('Cache-Control', 'no-store').json(result);
        })
        .catch(next);
    },
  );
};
