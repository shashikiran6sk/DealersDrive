import { DocumentPresignInput, IdParam } from '@dealers-drive/contracts';

import { adminPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type SalesRoute } from './route.js';

export const postDealerDocumentPresign: SalesRoute = (router, { service }) => {
  router.post(
    '/dealers/:id/documents/presign',
    requirePermission('sales:dealer:edit'),
    validate({ params: IdParam, body: DocumentPresignInput }),
    handle(
      (req) =>
        service.presignDocument(
          adminPrincipal(req),
          validated<IdParam>(req, 'params').id,
          validated<DocumentPresignInput>(req, 'body'),
        ),
      201,
    ),
  );
};
