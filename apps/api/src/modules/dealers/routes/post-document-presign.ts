import {
  DocumentPresignInput,
  type DocumentPresignInput as DocumentPresignInputType,
} from '@dealers-drive/contracts';

import { dealerPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { type DealersRoute } from './route.js';

export const postDocumentPresign: DealersRoute = (router, service) => {
  router.post(
    '/documents/presign',
    requirePermission('document:upload'),
    validate({ body: DocumentPresignInput }),
    (req, res, next) => {
      void (async () => {
        try {
          const { dealerId } = dealerPrincipal(req);
          const body = validated<DocumentPresignInputType>(req, 'body');
          res.status(201).json(await service.presignDocument(dealerId, body));
        } catch (error) {
          next(error);
        }
      })();
    },
  );
};
