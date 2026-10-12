import {
  YardVisitParam,
  YardVisitPhotoCommitInput,
  type YardVisitParam as YardVisitParamType,
  type YardVisitPhotoCommitInput as YardVisitPhotoCommitInputType,
} from '@dealers-drive/contracts';

import { adminPrincipal } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type AdminRoute } from './route.js';

export const postDealerYardVisitPhotoCommit: AdminRoute = (router, service) => {
  router.post(
    '/dealers/:id/yard-visits/:visitId/photos/commit',
    validate({ params: YardVisitParam, body: YardVisitPhotoCommitInput }),
    handle((req) => {
      const params = validated<YardVisitParamType>(req, 'params');
      return service.yardVisits.commitPhoto(
        adminPrincipal(req),
        params.id,
        params.visitId,
        validated<YardVisitPhotoCommitInputType>(req, 'body'),
      );
    }),
  );
};
