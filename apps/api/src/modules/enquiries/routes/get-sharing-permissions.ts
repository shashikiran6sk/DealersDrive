import { customerPrincipal } from '../../../middleware/auth.js';
import type { EnquiriesRoute } from './route.js';

export const getSharingPermissions: EnquiriesRoute = (router, { service }) => {
  router.get('/sharing-permissions', (req, res, next) => {
    void service
      .sharingPermissions(customerPrincipal(req))
      .then((result) => res.set('Cache-Control', 'no-store').json(result))
      .catch(next);
  });
};
