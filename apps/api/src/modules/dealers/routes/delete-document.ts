import { DocTypeParam, type DocTypeParam as DocTypeParamType } from '@dealers-drive/contracts';

import { dealerPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { type DealersRoute } from './route.js';

export const deleteDocument: DealersRoute = (router, service) => {
  router.delete(
    '/documents/:type',
    requirePermission('document:upload'),
    validate({ params: DocTypeParam }),
    (req, res, next) => {
      void (async () => {
        try {
          const { dealerId } = dealerPrincipal(req);
          const params = validated<DocTypeParamType>(req, 'params');
          await service.deleteDocument(dealerId, params.type);
          res.status(204).end();
        } catch (error) {
          next(error);
        }
      })();
    },
  );
};
