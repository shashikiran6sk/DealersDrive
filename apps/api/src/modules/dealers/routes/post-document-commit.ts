import {
  DocTypeParam,
  DocumentCommitInput,
  type DocTypeParam as DocTypeParamType,
  type DocumentCommitInput as DocumentCommitInputType,
} from '@dealers-drive/contracts';

import { dealerPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { type DealersRoute } from './route.js';

export const postDocumentCommit: DealersRoute = (router, service) => {
  router.post(
    '/documents/:type/commit',
    requirePermission('document:upload'),
    validate({ params: DocTypeParam, body: DocumentCommitInput }),
    (req, res, next) => {
      void (async () => {
        try {
          const { dealerId } = dealerPrincipal(req);
          const params = validated<DocTypeParamType>(req, 'params');
          const body = validated<DocumentCommitInputType>(req, 'body');
          res.json(await service.commitDocument(dealerId, params.type, body));
        } catch (error) {
          next(error);
        }
      })();
    },
  );
};
