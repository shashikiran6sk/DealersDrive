import {
  AdminCreditOrderParam,
  type AdminCreditOrderParam as AdminCreditOrderParamType,
} from '@dealers-drive/contracts';

import { adminPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type BillingRoute } from './route.js';

export const postAdminDealerCreditOrderRecheck: BillingRoute = (router, service) => {
  router.post(
    '/dealers/:id/credits/orders/:orderId/recheck',
    requirePermission('admin:credit:grant'),
    validate({ params: AdminCreditOrderParam }),
    handle((req) => {
      const params = validated<AdminCreditOrderParamType>(req, 'params');
      return service.recheckOrder(adminPrincipal(req), params.id, params.orderId);
    }),
  );
};
