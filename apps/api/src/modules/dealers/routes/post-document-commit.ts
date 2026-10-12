import {
  DocCategoryParam,
  DocumentCommitInput,
  type DocCategoryParam as DocCategoryParamType,
  type DocumentCommitInput as DocumentCommitInputType,
} from '@dealers-drive/contracts';

import { dealerPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { type DealersRoute } from './route.js';

export const postDocumentCommit: DealersRoute = (router, service) => {
  router.post(
    '/documents/:category/commit',
    requirePermission('document:upload'),
    validate({ params: DocCategoryParam, body: DocumentCommitInput }),
    (req, res, next) => {
      void (async () => {
        try {
          const { dealerId, userId } = dealerPrincipal(req);
          const params = validated<DocCategoryParamType>(req, 'params');
          const body = validated<DocumentCommitInputType>(req, 'body');
          res.json(
            await service.commitDocument(dealerId, params.category, body, {
              type: 'DEALER',
              id: userId,
            }),
          );
        } catch (error) {
          next(error);
        }
      })();
    },
  );
};
