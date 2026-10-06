import { DocumentCommitInput, SalesDealerDocParam } from '@dealers-drive/contracts';

import { adminPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type SalesRoute } from './route.js';

export const postDealerDocumentCommit: SalesRoute = (router, { service }) => {
  router.post(
    '/dealers/:id/documents/:type/commit',
    requirePermission('sales:dealer:edit'),
    validate({ params: SalesDealerDocParam, body: DocumentCommitInput }),
    handle((req) =>
      service.commitDocument(
        adminPrincipal(req),
        validated<SalesDealerDocParam>(req, 'params').id,
        validated<SalesDealerDocParam>(req, 'params').type,
        validated<DocumentCommitInput>(req, 'body'),
      ),
    ),
  );
};
