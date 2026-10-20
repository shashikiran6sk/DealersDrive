import { CustomerDeactivationInput } from '@dealers-drive/contracts';
import { customerPrincipal } from '../../../middleware/auth.js';
import { validate } from '../../../middleware/validate.js';
import { requireLegalOrigin } from '../../legal/legal.facade.js';
import { presentedCustomerCredential } from '../customer-session.js';
import { clearSessionCookie } from '../session.cookie.js';
import type { CustomerAuthRoute } from './route.js';

export const postCustomerDeactivate: CustomerAuthRoute = (router, { customers }) => {
  router.post(
    '/account/deactivate',
    requireLegalOrigin,
    validate({ body: CustomerDeactivationInput }),
    (req, res, next) => {
      void customers
        .deactivate(customerPrincipal(req), presentedCustomerCredential(req))
        .then((result) => {
          if (!req.get('authorization')) clearSessionCookie(res);
          res.set('Cache-Control', 'no-store').json(result);
        })
        .catch(next);
    },
  );
};
