import {
  CommitVehicleImageInput,
  ListingImageParam,
  type CommitVehicleImageInput as CommitVehicleImageInputType,
  type ListingImageParam as ListingImageParamType,
} from '@dealers-drive/contracts';

import { adminPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type VehicleImagesRoute } from './route.js';

export const postListingImageCommit: VehicleImagesRoute = (router, service) => {
  router.post(
    '/listings/:id/images/:mediaId/commit',
    requirePermission('admin:media:upload'),
    validate({ params: ListingImageParam, body: CommitVehicleImageInput }),
    handle((req) => {
      const params = validated<ListingImageParamType>(req, 'params');
      const body = validated<CommitVehicleImageInputType>(req, 'body');
      return service.commit(adminPrincipal(req), params.id, params.mediaId, {
        credit: body.credit,
      });
    }),
  );
};
