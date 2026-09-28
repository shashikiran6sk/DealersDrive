import { IdParam, UpdateEnquiryInput } from '@dealers-drive/contracts';

import { dealerPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import type { DealerEnquiriesRoute } from './dealer-route.js';
import { handle } from './handle.js';

export const patchDealerEnquiry: DealerEnquiriesRoute = (router, service) => {
  router.patch(
    '/enquiries/:id',
    requirePermission('enquiry:update'),
    validate({ params: IdParam, body: UpdateEnquiryInput }),
    handle((req) => {
      const { dealerId, userId } = dealerPrincipal(req);
      return service.setStatus(
        { dealerId, userId },
        validated<IdParam>(req, 'params').id,
        validated<UpdateEnquiryInput>(req, 'body'),
      );
    }),
  );
};
