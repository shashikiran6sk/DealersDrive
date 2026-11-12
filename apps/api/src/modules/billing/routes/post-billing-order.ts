import {
  CreateCreditOrderInput,
  type CreateCreditOrderInput as CreateCreditOrderInputType,
} from '@dealers-drive/contracts';

import { requireDealerActive, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { billingActorOf } from './actor.js';
import { handle, type BillingRoute } from './route.js';

export const postBillingOrder: BillingRoute = (router, service) => {
  router.post(
    '/billing/orders',
    requirePermission('billing:purchase'),
    requireDealerActive,
    validate({ body: CreateCreditOrderInput }),
    handle(
      (req) =>
        service.createOrder(
          billingActorOf(req),
          validated<CreateCreditOrderInputType>(req, 'body'),
        ),
      201,
    ),
  );
};
