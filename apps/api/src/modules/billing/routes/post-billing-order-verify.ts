import {
  IdParam,
  VerifyCreditOrderInput,
  type IdParam as IdParamType,
  type VerifyCreditOrderInput as VerifyCreditOrderInputType,
} from '@dealers-drive/contracts';

import { requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { billingActorOf } from './actor.js';
import { handle, type BillingRoute } from './route.js';

export const postBillingOrderVerify: BillingRoute = (router, service) => {
  router.post(
    '/billing/orders/:id/verify',
    requirePermission('billing:purchase'),
    validate({ params: IdParam, body: VerifyCreditOrderInput }),
    handle((req) =>
      service.verify(
        billingActorOf(req),
        validated<IdParamType>(req, 'params').id,
        validated<VerifyCreditOrderInputType>(req, 'body'),
      ),
    ),
  );
};
