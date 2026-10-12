import {
  DocCategoryParam,
  type DocCategoryParam as DocCategoryParamType,
} from '@dealers-drive/contracts';

import { dealerPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { type DealersRoute } from './route.js';

export const deleteDocument: DealersRoute = (router, service) => {
  router.delete(
    '/documents/:category',
    requirePermission('document:upload'),
    validate({ params: DocCategoryParam }),
    (req, res, next) => {
      void (async () => {
        try {
          const { dealerId } = dealerPrincipal(req);
          const params = validated<DocCategoryParamType>(req, 'params');
          await service.deleteDocument(dealerId, params.category);
          res.status(204).end();
        } catch (error) {
          next(error);
        }
      })();
    },
  );
};
