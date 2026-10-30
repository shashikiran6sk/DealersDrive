import { IdParam, type IdParam as IdParamType } from '@dealers-drive/contracts';

import { adminPrincipal } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type AdminRoute } from './route.js';

export const postDealerCustomerContactApprove: AdminRoute = (router, service) => {
  router.post(
    '/dealers/:id/customer-contact/approve',
    validate({ params: IdParam }),
    handle((req) =>
      service.approveCustomerContact(adminPrincipal(req), validated<IdParamType>(req, 'params').id),
    ),
  );
};
