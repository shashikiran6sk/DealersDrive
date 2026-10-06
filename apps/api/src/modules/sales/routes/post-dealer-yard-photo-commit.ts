import { IdParam, YardPhotoCommitInput } from '@dealers-drive/contracts';

import { adminPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type SalesRoute } from './route.js';

export const postDealerYardPhotoCommit: SalesRoute = (router, { service }) => {
  router.post(
    '/dealers/:id/yard-photo/commit',
    requirePermission('sales:dealer:edit'),
    validate({ params: IdParam, body: YardPhotoCommitInput }),
    handle((req) =>
      service.commitYardPhoto(
        adminPrincipal(req),
        validated<IdParam>(req, 'params').id,
        validated<YardPhotoCommitInput>(req, 'body'),
      ),
    ),
  );
};
