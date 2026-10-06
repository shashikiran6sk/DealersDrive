import { IdParam, YardPhotoPresignInput } from '@dealers-drive/contracts';

import { adminPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type SalesRoute } from './route.js';

export const postDealerYardPhotoPresign: SalesRoute = (router, { service }) => {
  router.post(
    '/dealers/:id/yard-photo/presign',
    requirePermission('sales:dealer:edit'),
    validate({ params: IdParam, body: YardPhotoPresignInput }),
    handle(
      (req) =>
        service.presignYardPhoto(
          adminPrincipal(req),
          validated<IdParam>(req, 'params').id,
          validated<YardPhotoPresignInput>(req, 'body'),
        ),
      201,
    ),
  );
};
