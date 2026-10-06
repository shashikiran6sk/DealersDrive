import { SalesDealerDocParam } from '@dealers-drive/contracts';

import { adminPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type SalesRoute } from './route.js';

export const deleteDealerDocument: SalesRoute = (router, { service }) => {
  router.delete(
    '/dealers/:id/documents/:type',
    requirePermission('sales:dealer:edit'),
    validate({ params: SalesDealerDocParam }),
    handle((req) =>
      service.deleteDocument(
        adminPrincipal(req),
        validated<SalesDealerDocParam>(req, 'params').id,
        validated<SalesDealerDocParam>(req, 'params').type,
      ),
    ),
  );
};
