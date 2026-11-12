import {
  AdminCreditAdjustmentInput,
  IdParam,
  type AdminCreditAdjustmentInput as AdminCreditAdjustmentInputType,
  type IdParam as IdParamType,
} from '@dealers-drive/contracts';

import { adminPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type BillingRoute } from './route.js';

export const postAdminDealerCredits: BillingRoute = (router, service) => {
  router.post(
    '/dealers/:id/credits',
    requirePermission('admin:credit:grant'),
    validate({ params: IdParam, body: AdminCreditAdjustmentInput }),
    handle((req) =>
      service.adjust(
        adminPrincipal(req),
        validated<IdParamType>(req, 'params').id,
        validated<AdminCreditAdjustmentInputType>(req, 'body'),
      ),
    ),
  );
};
