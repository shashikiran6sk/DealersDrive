import {
  YardVisitParam,
  YardVisitPhotoPresignInput,
  type YardVisitParam as YardVisitParamType,
  type YardVisitPhotoPresignInput as YardVisitPhotoPresignInputType,
} from '@dealers-drive/contracts';

import { adminPrincipal } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type AdminRoute } from './route.js';

export const postDealerYardVisitPhotoPresign: AdminRoute = (router, service) => {
  router.post(
    '/dealers/:id/yard-visits/:visitId/photos/presign',
    validate({ params: YardVisitParam, body: YardVisitPhotoPresignInput }),
    handle((req) => {
      const params = validated<YardVisitParamType>(req, 'params');
      return service.yardVisits.presignPhoto(
        adminPrincipal(req),
        params.id,
        params.visitId,
        validated<YardVisitPhotoPresignInputType>(req, 'body'),
      );
    }, 201),
  );
};
