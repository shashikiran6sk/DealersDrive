import { IdParam } from '@dealers-drive/contracts';

import { adminPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type SalesRoute } from './route.js';

export const postDealerSubmit: SalesRoute = (router, { service }) => {
  router.post(
    '/dealers/:id/submit',
    requirePermission('sales:dealer:submit'),
    validate({ params: IdParam }),
    handle((req) => service.submit(adminPrincipal(req), validated<IdParam>(req, 'params').id)),
  );
};
