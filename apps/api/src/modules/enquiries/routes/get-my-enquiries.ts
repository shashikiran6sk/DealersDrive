import { CustomerEnquiryQuery } from '@dealers-drive/contracts';

import { customerPrincipal } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle } from './handle.js';
import type { EnquiriesRoute } from './route.js';

export const getMyEnquiries: EnquiriesRoute = (router, { service }) => {
  router.get(
    '/',
    validate({ query: CustomerEnquiryQuery }),
    handle((req) =>
      service.mine(customerPrincipal(req), validated<CustomerEnquiryQuery>(req, 'query')),
    ),
  );
};
