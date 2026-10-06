import { IdParam } from '@dealers-drive/contracts';

import { adminPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type SalesRoute } from './route.js';

export const postDealerEmailVerification: SalesRoute = (router, { service }) => {
  router.post(
    '/dealers/:id/email-verification',
    requirePermission('sales:dealer:edit'),
    validate({ params: IdParam }),
    handle((req) =>
      service.resendEmailVerification(adminPrincipal(req), validated<IdParam>(req, 'params').id),
    ),
  );
};
