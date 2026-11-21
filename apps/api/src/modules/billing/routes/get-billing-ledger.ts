import { CursorQuery, type CursorQuery as CursorQueryType } from '@dealers-drive/contracts';

import { requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { billingActorOf } from './actor.js';
import { handle, type BillingRoute } from './route.js';

export const getBillingLedger: BillingRoute = (router, service) => {
  router.get(
    '/billing/ledger',
    requirePermission('billing:read'),
    validate({ query: CursorQuery }),
    handle((req) =>
      service.ledger(billingActorOf(req).dealerId, validated<CursorQueryType>(req, 'query')),
    ),
  );
};
